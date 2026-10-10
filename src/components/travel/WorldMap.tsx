"use client";

import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";
import world from "world-atlas/land-110m.json";
import type { TravelAlbum, TravelPhoto } from "@/lib/travel";

const projection = geoNaturalEarth1().fitExtent(
  [
    [25, 15],
    [975, 470],
  ],
  { type: "Sphere" },
);
const path = geoPath(projection);
const land = feature(
  world as unknown as Topology,
  world.objects.land as GeometryObject,
);

export default function WorldMap({
  albums,
  selected,
  onSelect,
  photos = [],
}: {
  albums: TravelAlbum[];
  selected: string;
  onSelect: (id: string) => void;
  photos?: TravelPhoto[];
}) {
  const places = albums.flatMap((album) => {
    const positions = new Map<
      string,
      {
        id: string;
        albumId: string;
        title: string;
        latitude: number;
        longitude: number;
      }
    >();
    for (const photo of photos.filter(
      (photo) => photo.albumId === album.id && photo.location,
    )) {
      const location = photo.location!;
      const key = `${album.id}:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`;
      if (!positions.has(key))
        positions.set(key, {
          id: key,
          albumId: album.id,
          title: `${album.title} · GPS ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
          ...location,
        });
    }
    if (positions.size) return [...positions.values()];
    return album.latitude !== null && album.longitude !== null
      ? [
          {
            id: album.id,
            albumId: album.id,
            title: `${album.title} · ${album.place}`,
            latitude: album.latitude,
            longitude: album.longitude,
          },
        ]
      : [];
  });
  return (
    <div className="travel-atlas">
      <div className="travel-atlas-caption">
        <span className="mono">WORLD / 世界足迹</span>
        <span>
          {places.length
            ? `${places.length} 个地点已标记`
            : "足迹从你发布的旅行中生成"}
        </span>
      </div>
      <svg
        viewBox="0 0 1000 490"
        role="group"
        aria-label="世界足迹地图，点击地点查看对应旅行"
      >
        <path d={path(geoGraticule10()) || ""} className="atlas-graticule" />
        <path d={path(land) || ""} className="atlas-land" />
        {places.map((album) => {
          const point = projection([album.longitude!, album.latitude!]);
          return (
            point && (
              <a
                key={album.id}
                href={`?trip=${album.albumId}`}
                aria-label={`查看${album.title}`}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(album.albumId);
                }}
                className={
                  selected === album.albumId
                    ? "atlas-pin is-selected"
                    : "atlas-pin"
                }
              >
                <circle
                  cx={point[0]}
                  cy={point[1]}
                  r="19"
                  className="atlas-hit"
                />
                <circle cx={point[0]} cy={point[1]} r="5" />
                <title>{album.title}</title>
              </a>
            )
          );
        })}
      </svg>
      <p className="atlas-credit">Natural Earth · 照片 GPS 与旅行参考点</p>
    </div>
  );
}
