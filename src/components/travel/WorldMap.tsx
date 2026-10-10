"use client";

import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";
import world from "world-atlas/land-110m.json";
import type { TravelAlbum, TravelPhoto } from "@/lib/travel";
import type { TravelConfig } from "@/lib/travel";
import dynamic from "next/dynamic";
import { tripLocation } from "@/lib/trip-presentation";

const GoogleMapView = dynamic(() => import("./GoogleMapView"), { ssr: false });

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
  mapConfig,
}: {
  albums: TravelAlbum[];
  selected: string;
  onSelect: (id: string) => void;
  photos?: TravelPhoto[];
  mapConfig?: TravelConfig;
}) {
  const places = albums.flatMap((album) => {
    const location = tripLocation(album, photos);
    return location
      ? [
          {
            id: album.id,
            albumId: album.id,
            title: `${album.title}${album.place ? ` · ${album.place}` : ""}`,
            ...location,
          },
        ]
      : [];
  });
  if (mapConfig?.googleMapsApiKey)
    return (
      <div className="travel-atlas google-travel-atlas">
        <div className="travel-atlas-caption">
          <span className="mono">WORLD / 旅行地图</span>
          <span>{albums.length} 次旅行 · 点击标记打开影集</span>
        </div>
        <GoogleMapView
          apiKey={mapConfig.googleMapsApiKey}
          mapId={mapConfig.googleMapsMapId}
          pins={albums.map((album) => ({
            id: album.id,
            label: album.title,
            location: tripLocation(album, photos),
            googlePlaceId: album.googlePlaceId,
          }))}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
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
      <p className="atlas-credit">
        Natural Earth · 每次旅行一个标记 · 优先使用旅行地点
      </p>
    </div>
  );
}
