import type { TravelAlbum, TravelPhoto } from "./travel";
import type { PhotoLocation } from "./photo-metadata";

export function tripCoverPhotos(
  album: TravelAlbum,
  photos: TravelPhoto[],
): TravelPhoto[] {
  const available = photos.filter((photo) => photo.albumId === album.id);
  const chosen = (album.coverPhotoIds || [])
    .map((id) => available.find((photo) => photo.id === id))
    .filter((photo): photo is TravelPhoto => Boolean(photo));
  if (chosen.length) return chosen.slice(0, 4);
  if (available.length <= 4) return available;
  return [0, 1, 2, 3].map(
    (index) => available[Math.round((index * (available.length - 1)) / 3)],
  );
}

export function tripLocation(
  album: TravelAlbum,
  photos: TravelPhoto[],
): PhotoLocation | null {
  // Google Places content is resolved only on a Google map, never persisted or
  // copied onto the fallback atlas. A saved user pin takes priority over EXIF.
  if (album.googlePlaceId) return null;
  if (album.latitude !== null && album.longitude !== null)
    return { latitude: album.latitude, longitude: album.longitude };
  return (
    photos.find((photo) => photo.albumId === album.id && photo.location)
      ?.location || null
  );
}

export function googleMapsLink(
  place: string,
  location?: PhotoLocation | null,
  placeId?: string | null,
): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set(
    "query",
    place || (location ? `${location.latitude},${location.longitude}` : "地点"),
  );
  if (placeId) url.searchParams.set("query_place_id", placeId);
  return url.href;
}

export function normalizeMapsConfig(input: unknown) {
  const data =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const apiKey = typeof data.apiKey === "string" ? data.apiKey.trim() : "";
  const mapId = typeof data.mapId === "string" ? data.mapId.trim() : "";
  if (apiKey && !/^AIza[A-Za-z0-9_-]{35}$/.test(apiKey))
    throw new Error(
      "请填写 Google Maps 的网站浏览器 API key，不要填写其他服务密钥",
    );
  if (mapId && !/^[A-Za-z0-9_-]{1,128}$/.test(mapId))
    throw new Error("Google Map ID 格式不正确");
  return { apiKey, mapId: mapId || "DEMO_MAP_ID" };
}

export function parseCoverIds(value: unknown): string[] {
  try {
    const ids = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(ids)
      ? [
          ...new Set(
            ids.filter(
              (id): id is string =>
                typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id),
            ),
          ),
        ].slice(0, 4)
      : [];
  } catch {
    return [];
  }
}
