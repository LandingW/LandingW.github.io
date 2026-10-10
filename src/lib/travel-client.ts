import {
  PHOTO_LIMIT,
  PHOTO_TYPES,
  adminAuthorization,
  serviceUrl,
  type TravelConfig,
} from "./travel";
import { normalizeMapsConfig } from "./trip-presentation";

export async function loadTravelConfig(): Promise<TravelConfig> {
  const response = await fetch("/travel-config.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("无法读取旅行配置");
  const config = await response.json();
  const base: TravelConfig = {
    apiUrl: serviceUrl(config.apiUrl),
    mediaUrl: serviceUrl(config.mediaUrl),
  };
  if (!base.mediaUrl) return base;
  try {
    const maps = await fetch(`${base.mediaUrl}/maps-config.json`, {
      cache: "no-cache",
      signal: AbortSignal.timeout(5000),
    });
    if (maps.ok) {
      const settings = normalizeMapsConfig(await maps.json());
      return {
        ...base,
        googleMapsApiKey: settings.apiKey,
        googleMapsMapId: settings.mapId,
      };
    }
  } catch {
    /* The gallery remains usable when map configuration is unavailable. */
  }
  return base;
}

export async function photoApi<T>(
  base: string,
  token: string,
  path: string,
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Authorization: adminAuthorization(token),
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: signal || AbortSignal.timeout(20000),
    credentials: "omit",
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new PhotoApiError(
      response.status,
      result.error || "请求失败，请稍后重试",
    );
  return result as T;
}

class PhotoApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
interface UploadInfo {
  id: string;
  completed?: boolean;
  fingerprint: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
}
interface UploadSession {
  id: string;
  parts: { partNumber: number; etag: string }[];
}

function putPart(
  url: string,
  blob: Blob,
  onProgress: (bytes: number) => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open("PUT", url);
    xhr.timeout = 120000;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (etag) resolve(etag.replaceAll('"', ""));
        else
          reject(
            new Error("R2 未返回 ETag，请检查 CORS 的 ExposeHeaders 设置"),
          );
      } else reject(new Error("分片上传失败，请检查 R2 跨域配置或稍后重试"));
    };
    xhr.onerror = () =>
      reject(new Error("网络连接中断，重新选择同一文件可以继续"));
    xhr.ontimeout = () =>
      reject(new Error("上传超时，重新选择同一文件可以继续"));
    xhr.onabort = () => reject(new DOMException("上传已停止", "AbortError"));
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      reject(new DOMException("上传已停止", "AbortError"));
      return;
    }
    xhr.send(blob);
  });
}

export async function uploadPhoto(
  base: string,
  token: string,
  albumId: string,
  file: File,
  onProgress: (value: number) => void,
  signal: AbortSignal,
) {
  if (!PHOTO_TYPES.has(file.type) || file.size < 1 || file.size > PHOTO_LIMIT)
    throw new Error(
      "第一版支持 64MiB 以内的 JPEG、PNG、WebP；RAW 请先导出 JPEG",
    );
  const signature = new Blob([
    `${file.name}:${file.size}:${file.lastModified}:`,
    file.slice(0, 1024 * 1024),
    file.slice(-1024 * 1024),
  ]);
  const fingerprint = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await signature.arrayBuffer()),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const key = `photo-upload:${base}:${albumId}:${fingerprint}`;
  let session: UploadSession | null = null;
  try {
    session = JSON.parse(sessionStorage.getItem(key) || "null");
    if (session && (!session.id || !Array.isArray(session.parts)))
      session = null;
  } catch {
    /* Continue without saved progress. */
  }
  const info = await (async () => {
    try {
      return session
        ? await photoApi<UploadInfo>(
            base,
            token,
            `/admin/uploads/${session.id}/resume`,
            { fingerprint },
            signal,
          )
        : await photoApi<UploadInfo>(
            base,
            token,
            "/admin/uploads/start",
            {
              albumId,
              filename: file.name,
              mime: file.type,
              bytes: file.size,
              fingerprint,
            },
            signal,
          );
    } catch (error) {
      if (error instanceof PhotoApiError && [404, 409].includes(error.status))
        sessionStorage.removeItem(key);
      throw error;
    }
  })();
  if (info.completed) {
    sessionStorage.removeItem(key);
    onProgress(1);
    return info.id;
  }
  session ||= { id: info.id, parts: [] };
  const save = () => {
    try {
      sessionStorage.setItem(key, JSON.stringify(session));
    } catch {
      /* Upload still works without session storage. */
    }
  };
  save();
  for (const part of info.parts) {
    const start = (part.partNumber - 1) * info.partSize;
    if (session.parts.some((saved) => saved.partNumber === part.partNumber)) {
      onProgress(Math.min(1, (start + info.partSize) / file.size));
      continue;
    }
    const blob = file.slice(start, Math.min(file.size, start + info.partSize));
    let etag = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        etag = await putPart(
          part.url,
          blob,
          (bytes) => onProgress((start + bytes) / file.size),
          signal,
        );
        break;
      } catch (error) {
        if (signal.aborted || attempt === 2) throw error;
      }
    }
    session.parts.push({ partNumber: part.partNumber, etag });
    save();
  }
  await photoApi(
    base,
    token,
    `/admin/uploads/${info.id}/complete`,
    { parts: session.parts.sort((a, b) => a.partNumber - b.partNumber) },
    signal,
  );
  sessionStorage.removeItem(key);
  onProgress(1);
  return info.id;
}
