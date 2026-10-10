import { AwsClient } from "aws4fetch";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import {
  albumInput,
  PART_SIZE,
  PHOTO_LIMIT,
  PHOTO_TYPES,
  serviceUrl,
  validId,
  type TravelManifest,
} from "../../../src/lib/travel";

export interface Env {
  DB: D1Database;
  ORIGINALS: R2Bucket;
  PUBLIC: R2Bucket;
  ALLOWED_ORIGINS: string;
  PUBLIC_MEDIA_URL: string;
  R2_ACCOUNT_ID: string;
  R2_ORIGINALS_BUCKET: string;
  MAX_ORIGINAL_BYTES: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  ADMIN_TOKEN: string;
  PROCESSOR_TOKEN: string;
  GITHUB_TOKEN: string;
  GITHUB_REPOSITORY: string;
}
interface PhotoRow {
  id: string;
  album_id: string;
  original_key: string;
  filename: string;
  mime: string;
  bytes: number;
  fingerprint: string;
  upload_id: string;
  state: string;
  revision: string;
  lease: string;
  width: number;
  height: number;
  caption: string;
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const now = () => new Date().toISOString();
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("Content-Length")) > 16384)
    throw new HttpError(413, "请求过大");
  const text = await request.text();
  if (text.length > 16384) throw new HttpError(413, "请求过大");
  try {
    const result = JSON.parse(text);
    if (!result || Array.isArray(result) || typeof result !== "object") throw 0;
    return result;
  } catch {
    throw new HttpError(400, "请求格式不正确");
  }
}
async function authorized(
  request: Request,
  expected: string,
  minimumLength = 32,
) {
  if (!expected || expected.length < minimumLength)
    throw new HttpError(503, "服务密钥尚未配置");
  const header = request.headers.get("Authorization") || "";
  let supplied = header.replace(/^Bearer /, "");
  if (minimumLength === 12 && header.startsWith("Basic ")) {
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(header.slice(6)), (char) => char.charCodeAt(0)),
      );
      supplied = decoded.startsWith("admin:") ? decoded.slice(6) : "";
    } catch {
      throw new HttpError(401, "管理密码格式不正确");
    }
  }
  const digest = async (text: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    );
  const [a, b] = await Promise.all([digest(supplied), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  if (difference !== 0) throw new HttpError(401, "管理口令不正确或已失效");
}
async function authorizeAdmin(request: Request, env: Env) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 12)
    throw new HttpError(503, "管理密码尚未配置");
  // CF-Connecting-IP is supplied by the Cloudflare edge. Only a digest is
  // retained, never the password or the plain IP; expired rows are pruned.
  const ip = request.headers.get("CF-Connecting-IP") || "local-unknown";
  const key = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const time = Date.now();
  // Reserve an attempt atomically before checking the password so concurrent
  // failed requests cannot evade the limit. A successful request clears it.
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_login_limits WHERE expires_at <= ?").bind(
      time,
    ),
    env.DB.prepare(
      "INSERT INTO admin_login_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=admin_login_limits.attempts+1 WHERE admin_login_limits.attempts < 5 RETURNING attempts",
    ).bind(key, time + 15 * 60 * 1000),
  ]);
  if (!results[1].results.length)
    throw new HttpError(429, "登录尝试过多，请 15 分钟后再试");
  await authorized(request, env.ADMIN_TOKEN, 12);
  await env.DB.prepare("DELETE FROM admin_login_limits WHERE key=?")
    .bind(key)
    .run();
}
async function photo(env: Env, id: string) {
  if (!validId(id)) throw new HttpError(400, "照片编号不正确");
  const row = await env.DB.prepare("SELECT * FROM photos WHERE id=?")
    .bind(id)
    .first<PhotoRow>();
  if (!row) throw new HttpError(404, "照片不存在");
  return row;
}
async function signed(
  env: Env,
  method: string,
  key: string,
  query: Record<string, string> = {},
) {
  if (
    !/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID) ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY
  )
    throw new HttpError(503, "R2 上传凭据尚未配置");
  const url = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_ORIGINALS_BUCKET}/${key}`,
  );
  url.searchParams.set("X-Amz-Expires", "1800");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  return (await client.sign(url, { method, aws: { signQuery: true } })).url;
}
async function uploadInfo(env: Env, row: PhotoRow) {
  if (row.state !== "uploading")
    throw new HttpError(409, "该文件不再处于上传状态");
  const parts = await Promise.all(
    Array.from({ length: Math.ceil(row.bytes / PART_SIZE) }, async (_, i) => ({
      partNumber: i + 1,
      url: await signed(env, "PUT", row.original_key, {
        uploadId: row.upload_id,
        partNumber: String(i + 1),
      }),
    })),
  );
  return {
    id: row.id,
    partSize: PART_SIZE,
    fingerprint: row.fingerprint,
    parts,
  };
}

export async function publishManifest(env: Env) {
  if (!serviceUrl(env.PUBLIC_MEDIA_URL))
    throw new HttpError(503, "公开图片地址尚未配置");
  const albums = await env.DB.prepare(
    "SELECT id,title,description,place,date,latitude,longitude FROM albums WHERE published=1 ORDER BY date DESC,created_at DESC",
  ).all();
  const photos = await env.DB.prepare(
    "SELECT p.id,p.album_id,p.caption,p.width,p.height,p.revision FROM photos p JOIN albums a ON a.id=p.album_id WHERE a.published=1 AND p.published=1 AND p.state='ready' ORDER BY p.created_at,p.id",
  ).all<PhotoRow>();
  const visible = new Set(photos.results.map((p) => p.album_id));
  const manifest: TravelManifest = {
    version: 1,
    updatedAt: now(),
    albums: albums.results.filter((a) =>
      visible.has(a.id as string),
    ) as unknown as TravelManifest["albums"],
    photos: photos.results.map((p) => ({
      id: p.id,
      albumId: p.album_id,
      caption: p.caption,
      width: p.width,
      height: p.height,
      thumbnail: `photos/${p.id}/${p.revision}/thumbnail.jpg`,
      preview: `photos/${p.id}/${p.revision}/preview.jpg`,
      dzi: `photos/${p.id}/${p.revision}/image.dzi`,
    })),
  };
  await env.PUBLIC.put("manifest.json", JSON.stringify(manifest), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=60",
    },
  });
  return manifest;
}

async function admin(request: Request, env: Env, path: string) {
  await authorizeAdmin(request, env);
  if (request.method === "GET" && path === "/admin/state") {
    const [albums, photos, usage] = await Promise.all([
      env.DB.prepare("SELECT * FROM albums ORDER BY created_at DESC").all(),
      env.DB.prepare(
        "SELECT id,album_id,filename,bytes,state,caption,published,error,width,height,derived_bytes,created_at,updated_at FROM photos WHERE state!='aborted' ORDER BY created_at DESC",
      ).all(),
      env.DB.prepare(
        "SELECT COALESCE(SUM(bytes),0) AS bytes FROM photos WHERE state!='aborted'",
      ).first<{ bytes: number }>(),
    ]);
    return json({
      albums: albums.results,
      photos: photos.results,
      usedBytes: usage?.bytes || 0,
      maxBytes: Number(env.MAX_ORIGINAL_BYTES),
      mediaUrl: env.PUBLIC_MEDIA_URL,
    });
  }
  if (request.method !== "POST") throw new HttpError(405, "不支持的操作");
  const input = await body(request);
  if (path === "/admin/albums") {
    const data = albumInput(input),
      id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO albums(id,title,description,place,date,latitude,longitude,created_at) VALUES(?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        data.title,
        data.description,
        data.place,
        data.date,
        data.latitude,
        data.longitude,
        now(),
      )
      .run();
    return json({ id }, 201);
  }
  const albumAction = path.match(
    /^\/admin\/albums\/([\w-]+)\/(edit|publish|unpublish)$/,
  );
  if (albumAction) {
    const [, id, action] = albumAction;
    if (
      !(await env.DB.prepare("SELECT id FROM albums WHERE id=?")
        .bind(id)
        .first())
    )
      throw new HttpError(404, "旅行不存在");
    if (action === "edit") {
      const d = albumInput(input);
      await env.DB.prepare(
        "UPDATE albums SET title=?,description=?,place=?,date=?,latitude=?,longitude=? WHERE id=?",
      )
        .bind(
          d.title,
          d.description,
          d.place,
          d.date,
          d.latitude,
          d.longitude,
          id,
        )
        .run();
    } else {
      await env.DB.batch([
        env.DB.prepare("UPDATE albums SET published=? WHERE id=?").bind(
          action === "publish" ? 1 : 0,
          id,
        ),
        env.DB.prepare(
          "UPDATE photos SET published=? WHERE album_id=? AND state='ready'",
        ).bind(action === "publish" ? 1 : 0, id),
      ]);
    }
    await publishManifest(env);
    return json({ ok: true });
  }
  if (path === "/admin/uploads/start") {
    const { albumId, filename, mime, bytes, fingerprint } = input;
    if (
      !validId(albumId) ||
      typeof filename !== "string" ||
      filename.length > 200 ||
      /[\x00-\x1f]/.test(filename) ||
      typeof mime !== "string" ||
      !PHOTO_TYPES.has(mime) ||
      typeof bytes !== "number" ||
      !Number.isInteger(bytes) ||
      bytes < 1 ||
      bytes > PHOTO_LIMIT ||
      typeof fingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(fingerprint)
    )
      throw new HttpError(400, "仅支持 64MiB 以内的 JPEG、PNG、WebP 照片");
    if (
      !(await env.DB.prepare("SELECT id FROM albums WHERE id=?")
        .bind(albumId)
        .first())
    )
      throw new HttpError(404, "请先创建旅行");
    const id = crypto.randomUUID(),
      key = `originals/${id}/source`,
      timestamp = now();
    const reservation = await env.DB.prepare(
      "INSERT INTO photos(id,album_id,original_key,filename,mime,bytes,fingerprint,state,created_at,updated_at) SELECT ?,?,?,?,?,?,?,'uploading',?,? WHERE (SELECT COALESCE(SUM(bytes),0) FROM photos WHERE state!='aborted') + ? <= ?",
    )
      .bind(
        id,
        albumId,
        key,
        filename,
        mime,
        bytes,
        fingerprint,
        timestamp,
        timestamp,
        bytes,
        Number(env.MAX_ORIGINAL_BYTES),
      )
      .run();
    if (!reservation.meta.changes)
      throw new HttpError(413, "已达到 2GB 原片试用额度，请先清理未完成上传");
    let upload;
    try {
      upload = await env.ORIGINALS.createMultipartUpload(key, {
        httpMetadata: { contentType: mime },
      });
      await env.DB.prepare("UPDATE photos SET upload_id=? WHERE id=?")
        .bind(upload.uploadId, id)
        .run();
      return json(await uploadInfo(env, await photo(env, id)), 201);
    } catch (error) {
      if (upload) await upload.abort().catch(() => {});
      await env.DB.prepare("UPDATE photos SET state='aborted' WHERE id=?")
        .bind(id)
        .run();
      throw error;
    }
  }
  const uploadAction = path.match(
    /^\/admin\/uploads\/([\w-]+)\/(resume|complete|abort)$/,
  );
  if (uploadAction) {
    const [, id, action] = uploadAction,
      row = await photo(env, id);
    if (action === "resume") {
      if (input.fingerprint !== row.fingerprint)
        throw new HttpError(409, "请选择原来的同一文件");
      if (["queued", "processing", "ready"].includes(row.state))
        return json({ id: row.id, completed: true });
      return json(await uploadInfo(env, row));
    }
    if (action === "abort") {
      if (row.state !== "uploading")
        throw new HttpError(409, "只能取消未完成的上传");
      await env.ORIGINALS.resumeMultipartUpload(
        row.original_key,
        row.upload_id,
      ).abort();
      await env.DB.prepare(
        "UPDATE photos SET state='aborted',updated_at=? WHERE id=? AND state='uploading'",
      )
        .bind(now(), id)
        .run();
      return json({ ok: true });
    }
    if (["queued", "processing", "ready"].includes(row.state))
      return json({ ok: true });
    if (row.state !== "uploading") throw new HttpError(409, "当前上传不可完成");
    const parts = input.parts as { partNumber: number; etag: string }[];
    if (
      !Array.isArray(parts) ||
      parts.length !== Math.ceil(row.bytes / PART_SIZE) ||
      parts.some(
        (p, i) =>
          !p ||
          p.partNumber !== i + 1 ||
          typeof p.etag !== "string" ||
          !/^[\x21-\x7e]{1,200}$/.test(p.etag),
      )
    )
      throw new HttpError(400, "上传分片不完整");
    await env.ORIGINALS.resumeMultipartUpload(
      row.original_key,
      row.upload_id,
    ).complete(parts);
    const stored = await env.ORIGINALS.head(row.original_key);
    if (!stored || stored.size !== row.bytes) {
      await env.ORIGINALS.delete(row.original_key);
      await env.DB.prepare("UPDATE photos SET state='aborted' WHERE id=?")
        .bind(id)
        .run();
      throw new HttpError(400, "文件大小校验失败，请重新上传");
    }
    await env.DB.prepare(
      "UPDATE photos SET state='queued',updated_at=? WHERE id=? AND state='uploading'",
    )
      .bind(now(), id)
      .run();
    return json({ ok: true });
  }
  const retry = path.match(/^\/admin\/photos\/([\w-]+)\/retry$/);
  if (retry) {
    const result = await env.DB.prepare(
      "UPDATE photos SET state='queued',error=NULL,updated_at=? WHERE id=? AND state='failed'",
    )
      .bind(now(), retry[1])
      .run();
    if (!result.meta.changes)
      throw new HttpError(409, "只有失败的照片可以重试");
    return json({ ok: true });
  }
  if (path === "/admin/process") {
    if (!env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY))
      throw new HttpError(503, "GitHub 图片处理凭据尚未配置");
    const queued = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM photos WHERE state='queued' OR (state='processing' AND updated_at < ?)",
    )
      .bind(new Date(Date.now() - 3600_000).toISOString())
      .first<{ count: number }>();
    if (!queued?.count) return json({ ok: true, message: "没有待处理照片" });
    const response = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/photos.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "landingw-photos",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    );
    if (!response.ok)
      throw new HttpError(
        502,
        "无法启动处理任务，请检查工作流是否已发布以及 GitHub 凭据权限",
      );
    return json({ ok: true, message: "已启动图片处理任务，完成后可在此发布" });
  }
  throw new HttpError(404, "接口不存在");
}

async function internal(request: Request, env: Env, path: string) {
  await authorized(request, env.PROCESSOR_TOKEN);
  if (request.method !== "POST") throw new HttpError(405, "不支持的操作");
  if (path === "/internal/claim") {
    const input = await body(request);
    const onlyId = input.photoId === undefined ? "" : input.photoId;
    if (typeof onlyId !== "string" || (onlyId && !validId(onlyId)))
      throw new HttpError(400, "照片编号不正确");
    const lease = crypto.randomUUID(),
      revision = crypto.randomUUID(),
      timestamp = now();
    const row = await env.DB.prepare(
      "UPDATE photos SET state='processing',lease=?,revision=?,updated_at=?,error=NULL WHERE id=(SELECT id FROM photos WHERE (state='queued' OR (state='processing' AND updated_at < ?)) AND (?='' OR id=?) ORDER BY created_at LIMIT 1) RETURNING *",
    )
      .bind(
        lease,
        revision,
        timestamp,
        new Date(Date.now() - 3600_000).toISOString(),
        onlyId,
        onlyId,
      )
      .first<PhotoRow>();
    if (!row) return json({ job: null });
    try {
      return json({
        job: {
          id: row.id,
          lease,
          revision,
          bytes: row.bytes,
          mime: row.mime,
          sourceUrl: await signed(env, "GET", row.original_key),
          prefix: `photos/${row.id}/${revision}/`,
        },
      });
    } catch (error) {
      await env.DB.prepare(
        "UPDATE photos SET state='failed',error='原文件下载授权失败',updated_at=? WHERE id=? AND lease=?",
      )
        .bind(now(), row.id, lease)
        .run();
      throw error;
    }
  }
  const match = path.match(/^\/internal\/photos\/([\w-]+)\/(complete|fail)$/);
  if (!match) throw new HttpError(404, "接口不存在");
  const [, id, action] = match,
    input = await body(request),
    row = await photo(env, id);
  if (
    action === "complete" &&
    row.state === "ready" &&
    input.lease === row.lease
  )
    return json({ ok: true });
  if (row.state !== "processing" || input.lease !== row.lease)
    throw new HttpError(409, "处理任务已过期");
  if (action === "fail") {
    // Never persist raw decoder errors: they can contain a signed URL, filename or EXIF.
    await env.DB.prepare(
      "UPDATE photos SET state='failed',error='图片处理失败，请确认文件完整且格式受支持后重试',updated_at=? WHERE id=? AND lease=? AND state='processing'",
    )
      .bind(now(), id, row.lease)
      .run();
  } else {
    const { width, height, tileCount, derivedBytes } = input;
    if (
      ![width, height, tileCount, derivedBytes].every(
        (n) => typeof n === "number" && Number.isSafeInteger(n) && n > 0,
      ) ||
      Number(width) * Number(height) > 200_000_000 ||
      Number(tileCount) > 5000 ||
      Number(derivedBytes) > 512 * 1024 * 1024
    )
      throw new HttpError(400, "处理结果超出限制");
    const prefix = `photos/${id}/${row.revision}/`;
    for (const name of ["image.dzi", "preview.jpg", "thumbnail.jpg"])
      if (!(await env.PUBLIC.head(prefix + name)))
        throw new HttpError(409, "展示文件尚未完整上传");
    await env.DB.prepare(
      "UPDATE photos SET state='ready',width=?,height=?,tile_count=?,derived_bytes=?,error=NULL,updated_at=? WHERE id=? AND lease=? AND state='processing'",
    )
      .bind(width, height, tileCount, derivedBytes, now(), id, row.lease)
      .run();
  }
  return json({ ok: true });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin"),
      allowed = env.ALLOWED_ORIGINS.split(",").map((item) => item.trim());
    if (origin && !allowed.includes(origin))
      return json({ error: "不允许的来源" }, 403);
    let response: Response;
    try {
      if (request.method === "OPTIONS")
        response = new Response(null, { status: 204 });
      else {
        const path = new URL(request.url).pathname.replace(/\/$/, "");
        if (path.startsWith("/admin/"))
          response = await admin(request, env, path);
        else if (path.startsWith("/internal/"))
          response = await internal(request, env, path);
        else if (path === "/health" && request.method === "GET")
          response = json({ ok: true });
        else throw new HttpError(404, "接口不存在");
      }
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof TypeError ||
              (error instanceof Error &&
                /格式|长度|日期|经纬度|HTTPS|缺少/.test(error.message))
            ? 400
            : 500;
      response = json(
        {
          error:
            status < 500 || error instanceof HttpError
              ? (error as Error).message
              : "服务暂不可用，请稍后重试",
        },
        status,
      );
      if (status === 429) response.headers.set("Retry-After", "900");
    }
    if (origin) response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  },
};
export default worker;
