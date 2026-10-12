"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";
import world from "world-atlas/land-110m.json";
import {
  mediaUrl,
  type TravelAlbum,
  type TravelPhoto,
  type TravelConfig,
} from "@/lib/travel";
import { tripCoverPhotos } from "@/lib/trip-presentation";
import { worldFootprints, worldProjection } from "@/lib/world-footprints";

const path = geoPath(worldProjection);
const land = feature(
  world as unknown as Topology,
  world.objects.land as GeometryObject,
);
const gridPath = path(geoGraticule10()) || "";
const landPath = path(land) || "";

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
  const [hovered, setHovered] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewId = useId();
  const markers = worldFootprints(
    albums,
    photos,
    44000 / Math.max(200, canvasWidth),
  );
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setCanvasWidth(width);
    });
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  const active = markers.find((marker) => marker.id === hovered);
  const marked = markers.reduce((sum, marker) => sum + marker.albums.length, 0);
  function keepOpen(id: string) {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setHovered(id);
  }
  function dismissSoon() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setHovered(null), 180);
  }
  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    [],
  );
  function open(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (
      event.button ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setHovered(null);
    onSelect(id);
  }
  return (
    <div
      className="travel-atlas"
      onKeyDown={(event) => {
        if (event.key === "Escape") setHovered(null);
      }}
    >
      <div className="travel-atlas-caption">
        <span className="mono">WORLD / 世界足迹</span>
        <span>
          {marked
            ? `${marked} 次旅行已标记 · 悬停预览，点击进入`
            : "设置旅行地点后，足迹会出现在这里"}
        </span>
      </div>
      <div
        ref={canvas}
        className="atlas-canvas"
        role="group"
        aria-label="世界足迹地图，悬停预览旅行，点击图钉进入影集"
        onPointerLeave={dismissSoon}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setHovered(null);
        }}
      >
        <svg viewBox="0 0 1000 490" aria-hidden="true">
          <path d={gridPath} className="atlas-graticule" />
          <path d={landPath} className="atlas-land" />
        </svg>
        {markers.map((marker) => {
          const first =
            marker.albums.find((album) => album.id === selected) ||
            marker.albums[0];
          const label = marker.albums
            .map(
              (album) =>
                `${album.title}${album.place ? ` · ${album.place}` : ""}`,
            )
            .join("、");
          return (
            <a
              key={marker.id}
              data-pin={marker.id}
              href={`/travel/?trip=${first.id}`}
              className={`atlas-pin${marker.albums.some((album) => album.id === selected) ? " is-selected" : ""}`}
              style={{ left: `${marker.x / 10}%`, top: `${marker.y / 4.9}%` }}
              aria-label={`查看${label}${marker.albums.length > 1 ? `，共 ${marker.albums.length} 次旅行` : ""}`}
              aria-describedby={
                active?.id === marker.id ? previewId : undefined
              }
              onClick={(event) => open(event, first.id)}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") keepOpen(marker.id);
              }}
              onPointerLeave={dismissSoon}
              onFocus={() => keepOpen(marker.id)}
            >
              <svg viewBox="0 0 32 42" aria-hidden="true">
                <path d="M16 40C13 35 2 23 2 16a14 14 0 1 1 28 0c0 7-11 19-14 24Z" />
                <circle cx="16" cy="16" r="5" />
              </svg>
              {marker.albums.length > 1 && (
                <span className="atlas-count">{marker.albums.length}</span>
              )}
            </a>
          );
        })}
        {active && (
          <div
            id={previewId}
            className="atlas-preview"
            data-below={active.y < 170}
            style={{
              left: `clamp(130px, ${active.x / 10}%, calc(100% - 130px))`,
              top: `${active.y / 4.9}%`,
            }}
            onPointerEnter={() => keepOpen(active.id)}
            onPointerLeave={dismissSoon}
          >
            <span className="atlas-preview-kicker mono">
              {active.albums.length > 1
                ? `${active.albums.length} 次旅行 · 同一片风景`
                : "TRAVEL NOTE"}
            </span>
            {active.albums.map((album) => {
              const cover = tripCoverPhotos(album, photos)[0];
              const count = photos.filter(
                (photo) => photo.albumId === album.id,
              ).length;
              return (
                <a
                  key={album.id}
                  href={`/travel/?trip=${album.id}`}
                  className="atlas-preview-trip"
                  onClick={(event) => open(event, album.id)}
                >
                  {cover && mapConfig?.mediaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(mapConfig.mediaUrl, cover.thumbnail)}
                      width={cover.width}
                      height={cover.height}
                      alt=""
                    />
                  )}
                  <span>
                    <strong>{album.title}</strong>
                    <span>
                      {album.place || album.date || "旅行记录"} · {count} 张照片
                    </span>
                  </span>
                  <span aria-hidden="true">↗</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
      <p className="atlas-credit">
        Natural Earth · 图钉来自旅行坐标或公开照片 GPS
        {marked < albums.length
          ? ` · ${albums.length - marked} 次旅行待设置地点`
          : ""}
      </p>
    </div>
  );
}
