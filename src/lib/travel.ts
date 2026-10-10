import {
  normalizeCamera,
  normalizeLocation,
  type CameraMetadata,
  type PhotoLocation,
} from "./photo-metadata";

export const PHOTO_LIMIT = 64 * 1024 * 1024;
export const PART_SIZE = 8 * 1024 * 1024;
export const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function adminAuthorization(password: string): string {
  // Header values are ASCII. UTF-8 Basic encoding also supports a self-chosen
  // password containing non-Latin characters; HTTPS remains mandatory.
  const bytes = new TextEncoder().encode(`admin:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

export interface TravelAlbum {
  id: string;
  title: string;
  description: string;
  place: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId?: string | null;
  coverPhotoIds?: string[];
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
  camera?: CameraMetadata | null;
  location?: PhotoLocation | null;
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
  googleMapsApiKey?: string;
  googleMapsMapId?: string;
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
      (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
    (longitude !== null &&
      (!Number.isFinite(longitude) || Math.abs(longitude) > 180))
  )
    throw new Error("请填写有效的经纬度，或将两项都留空");
  const date = text("date", 10);
  const googlePlaceId =
    v.googlePlaceId === null || v.googlePlaceId === undefined
      ? null
      : text("googlePlaceId", 1024);
  if (googlePlaceId && /[\x00-\x20\x7f]/.test(googlePlaceId))
    throw new Error("Google Place ID 格式不正确");
  const covers = v.coverPhotoIds === undefined ? [] : v.coverPhotoIds;
  if (
    !Array.isArray(covers) ||
    covers.length > 4 ||
    covers.some((id) => !validId(id)) ||
    new Set(covers).size !== covers.length
  )
    throw new Error("封面最多选择四张不重复的照片");
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
    latitude: googlePlaceId ? null : latitude,
    longitude: googlePlaceId ? null : longitude,
    googlePlaceId: googlePlaceId || null,
    coverPhotoIds: covers,
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
    return {
      ...photo,
      camera: normalizeCamera(photo.camera),
      location: normalizeLocation(photo.location),
    };
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
