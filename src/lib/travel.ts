export const PHOTO_LIMIT = 64 * 1024 * 1024;
export const PART_SIZE = 8 * 1024 * 1024;
export const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface TravelAlbum {
  id: string;
  title: string;
  description: string;
  place: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
}

export interface TravelPhoto {
  id: string;
  albumId: string;
  caption: string;
  width: number;
  height: number;
  thumbnail: string;
  preview: string;
  dzi: string;
}

export interface TravelManifest {
  version: 1;
  updatedAt: string | null;
  albums: TravelAlbum[];
  photos: TravelPhoto[];
}

export interface TravelConfig {
  apiUrl: string;
  mediaUrl: string;
}

export const EMPTY_MANIFEST: TravelManifest = {
  version: 1,
  updatedAt: null,
  albums: [],
  photos: [],
};

export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

export function serviceUrl(value: unknown): string {
  if (value === "") return "";
  if (typeof value !== "string") throw new Error("服务地址格式不正确");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("服务地址必须使用 HTTPS");
  return url.href.replace(/\/$/, "");
}

export function mediaUrl(base: string, path: string): string {
  if (
    !/^photos\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/(thumbnail\.jpg|preview\.jpg|image\.dzi)$/.test(
      path,
    )
  )
    throw new Error("图片路径不正确");
  return `${serviceUrl(base)}/${path}`;
}

export function albumInput(value: unknown): Omit<TravelAlbum, "id"> {
  if (!value || typeof value !== "object") throw new Error("缺少旅行信息");
  const v = value as Record<string, unknown>;
  function text(name: string, max: number, required = false) {
    const input = v[name];
    if (input !== undefined && typeof input !== "string")
      throw new Error(`${name} 格式不正确`);
    const result = ((input as string) || "").trim();
    if (result.length > max || (required && !result))
      throw new Error(`${name} 长度不正确`);
    return result;
  }
  const latitude =
    v.latitude === null || v.latitude === undefined || v.latitude === ""
      ? null
      : Number(v.latitude);
  const longitude =
    v.longitude === null || v.longitude === undefined || v.longitude === ""
      ? null
      : Number(v.longitude);
  if (
    (latitude === null) !== (longitude === null) ||
    (latitude !== null &&
      (!Number.isFinite(latitude) || Math.abs(latitude) > 85)) ||
    (longitude !== null &&
      (!Number.isFinite(longitude) || Math.abs(longitude) > 180))
  )
    throw new Error("请填写有效的经纬度，或将两项都留空");
  const date = text("date", 10);
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    throw new Error("日期不正确");
  return {
    title: text("title", 100, true),
    description: text("description", 1200),
    place: text("place", 120),
    date,
    latitude,
    longitude,
  };
}

export function parseManifest(input: unknown): TravelManifest {
  if (!input || typeof input !== "object") throw new Error("相册数据无法读取");
  const v = input as TravelManifest;
  if (
    v.version !== 1 ||
    !Array.isArray(v.albums) ||
    !Array.isArray(v.photos) ||
    v.albums.length > 1000 ||
    v.photos.length > 10000
  )
    throw new Error("相册数据格式不正确");
  const albums = v.albums.map((album) => {
    if (!validId(album.id)) throw new Error("旅行编号不正确");
    return { id: album.id, ...albumInput(album) };
  });
  const ids = new Set(albums.map((album) => album.id));
  if (ids.size !== albums.length) throw new Error("旅行编号重复");
  const photos = v.photos.map((photo) => {
    if (
      !validId(photo.id) ||
      !ids.has(photo.albumId) ||
      !Number.isInteger(photo.width) ||
      !Number.isInteger(photo.height) ||
      photo.width < 1 ||
      photo.height < 1 ||
      photo.width * photo.height > 200_000_000 ||
      typeof photo.caption !== "string" ||
      photo.caption.length > 200
    )
      throw new Error("照片信息不正确");
    for (const path of [photo.thumbnail, photo.preview, photo.dzi])
      mediaUrl("https://example.com", path);
    return photo;
  });
  if (new Set(photos.map((photo) => photo.id)).size !== photos.length)
    throw new Error("照片编号重复");
  return {
    version: 1,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null,
    albums,
    photos,
  };
}

export function formatBytes(bytes: number) {
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}
