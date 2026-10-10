"use client";

import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";
import world from "world-atlas/land-110m.json";
import type { TravelAlbum } from "@/lib/travel";

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
}: {
  albums: TravelAlbum[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const places = albums.filter(
    (album) => album.latitude !== null && album.longitude !== null,
  );
  return (
    <div className="travel-atlas">
      <div className="travel-atlas-caption">
        <span className="mono">WORLD / 世界足迹</span>
        <span>
          {places.length
            ? `${places.length} 次旅行已标记`
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
                href={`?trip=${album.id}`}
                aria-label={`查看${album.title}，${album.place}`}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(album.id);
                }}
                className={
                  selected === album.id ? "atlas-pin is-selected" : "atlas-pin"
                }
              >
                <circle
                  cx={point[0]}
                  cy={point[1]}
                  r="19"
                  className="atlas-hit"
                />
                <circle cx={point[0]} cy={point[1]} r="5" />
                <title>{`${album.title} · ${album.place}`}</title>
              </a>
            )
          );
        })}
      </svg>
      <p className="atlas-credit">Natural Earth · 足迹只使用你确认公开的地点</p>
    </div>
  );
}
