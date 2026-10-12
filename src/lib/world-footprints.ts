import { geoNaturalEarth1 } from "d3-geo";
import { tripLocation } from "./trip-presentation";
import { normalizeLocation } from "./photo-metadata";
import type { TravelAlbum, TravelPhoto } from "./travel";

export const worldProjection = geoNaturalEarth1().fitExtent(
  [
    [25, 15],
    [975, 470],
  ],
  { type: "Sphere" },
);
export interface Footprint {
  id: string;
  x: number;
  y: number;
  albums: TravelAlbum[];
}
export function worldFootprints(
  albums: TravelAlbum[],
  photos: TravelPhoto[],
  minimumDistance = 44,
): Footprint[] {
  const markers: Footprint[] = [];
  for (const album of albums) {
    const location = normalizeLocation(tripLocation(album, photos));
    if (!location) continue;
    const point = worldProjection([location.longitude, location.latitude]);
    if (!point || !point.every(Number.isFinite)) continue;
    // Nearby trips share a pin, with every trip available in its preview.
    // Only the display is grouped; stored coordinates are never moved.
    const nearby = markers.find(
      (marker) =>
        Math.hypot(marker.x - point[0], marker.y - point[1]) < minimumDistance,
    );
    if (nearby) nearby.albums.push(album);
    else
      markers.push({ id: album.id, x: point[0], y: point[1], albums: [album] });
  }
  return markers;
}
