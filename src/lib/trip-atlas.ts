import { normalizeLocation, type PhotoLocation } from "./photo-metadata";
import type { TravelAlbum, TravelPhoto } from "./travel";
import { STOP_KINDS, type StopKind } from "./trip-route";

export interface TripPoint extends PhotoLocation {
  id: string;
  label: string;
  source: "trip" | "photo" | "mixed" | "stop";
  photos: TravelPhoto[];
  stopIndex?: number;
  kind?: StopKind;
  note?: string;
}

// A trip pin is a destination, not the presumed location of every photograph.
export function tripPoints(
  album: TravelAlbum,
  photos: TravelPhoto[],
): TripPoint[] {
  const points: TripPoint[] = [];
  for (const [index, stop] of (album.stops || []).entries()) {
    points.push({
      ...stop,
      id: `stop-${stop.id}`,
      label: stop.name,
      source: "stop",
      stopIndex: index,
      photos: [],
    });
  }
  const destination = !album.googlePlaceId ? normalizeLocation(album) : null;
  if (destination && !points.length)
    points.push({
      ...destination,
      id: `trip-${album.id}`,
      label: album.place || "旅行定位",
      source: "trip",
      photos: [],
    });
  for (const photo of photos) {
    if (photo.albumId !== album.id) continue;
    const location = normalizeLocation(photo.location);
    if (!location) continue;
    // Co-located images share a visible pin; original coordinates stay intact.
    const same = points.find(
      (point) =>
        point.latitude.toFixed(5) === location.latitude.toFixed(5) &&
        point.longitude.toFixed(5) === location.longitude.toFixed(5),
    );
    if (same) {
      same.photos.push(photo);
      if (same.source === "trip") same.source = "mixed";
    } else
      points.push({
        ...location,
        id: `photo-${photo.id}`,
        label:
          photo.caption ||
          `拍摄点 ${String(points.filter((p) => p.source === "photo").length + 1).padStart(2, "0")}`,
        source: "photo",
        photos: [photo],
      });
  }
  return points;
}

export function coordinateLabel(point: PhotoLocation, precision = 4) {
  return `${Math.abs(point.latitude).toFixed(precision)}° ${point.latitude < 0 ? "S" : "N"} / ${Math.abs(point.longitude).toFixed(precision)}° ${point.longitude < 0 ? "W" : "E"}`;
}

export function pointSource(point: TripPoint) {
  if (point.source === "stop")
    return `${STOP_KINDS[point.kind || "place"]} · 行程站点${point.photos.length ? " · 照片 GPS" : ""}`;
  return point.source === "trip"
    ? "旅行定位"
    : point.source === "mixed"
      ? "旅行定位 · 照片 GPS"
      : "照片 GPS";
}

export function osmPointLink(point: PhotoLocation) {
  return `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=14/${point.latitude}/${point.longitude}`;
}

// Fit the smallest longitude interval, including trips across the date line.
export function mapCoordinates(points: PhotoLocation[]): [number, number][] {
  if (!points.length) return [];
  const longitudes = points
    .map((p) => ((p.longitude % 360) + 360) % 360)
    .sort((a, b) => a - b);
  let largest = -1,
    start = longitudes[0];
  for (let i = 0; i < longitudes.length; i++) {
    const next =
      i + 1 < longitudes.length ? longitudes[i + 1] : longitudes[0] + 360;
    if (next - longitudes[i] > largest) {
      largest = next - longitudes[i];
      start = next % 360;
    }
  }
  return points.map((p) => {
    let longitude = ((p.longitude % 360) + 360) % 360;
    if (longitude < start) longitude += 360;
    // Keep the first point close to its canonical longitude for Leaflet tiles.
    const shift = start > 180 ? 360 : 0;
    return [Math.max(-85, Math.min(85, p.latitude)), longitude - shift];
  });
}
