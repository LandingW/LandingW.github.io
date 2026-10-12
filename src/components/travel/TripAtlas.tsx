"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  coordinateLabel,
  osmPointLink,
  pointSource,
  tripPoints,
} from "@/lib/trip-atlas";
import {
  mediaUrl,
  type TravelAlbum,
  type TravelConfig,
  type TravelPhoto,
} from "@/lib/travel";

const TripPlacesMap = dynamic(() => import("./TripPlacesMap"), {
  ssr: false,
  loading: () => (
    <div className="journey-map-placeholder" role="status">
      正在展开地图…
    </div>
  ),
});

export default function TripAtlas({
  album,
  photos,
  config,
  onOpen,
}: {
  album: TravelAlbum;
  photos: TravelPhoto[];
  config: TravelConfig;
  onOpen: (id: string) => void;
}) {
  const points = useMemo(() => tripPoints(album, photos), [album, photos]);
  const [selected, setSelected] = useState(points[0]?.id || "");
  const [mapVisible, setMapVisible] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const active = points.find((point) => point.id === selected) || points[0];
  const located = photos.filter(
    (photo) => photo.albumId === album.id && photo.location,
  ).length;
  useEffect(() => {
    if (!container.current || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMapVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return (
    <section
      className="journey-places journey-section"
      id="story-places"
      aria-labelledby="places-title"
    >
      <header className="journey-section-heading" data-reveal>
        <div>
          <p className="eyebrow">01 / THE LOCATION</p>
          <h2 id="places-title">
            风景的坐标<span className="accent">.</span>
          </h2>
        </div>
        <p>
          从一张照片，走近一个地方。
          <br />
          {points.length
            ? `${points.length} 个已记录点位 · ${located} 张照片带 GPS`
            : "这段旅程还没有公开的坐标。"}
        </p>
      </header>
      <div className="journey-atlas-layout" ref={container}>
        <div className="journey-map-stage">
          {points.length ? (
            mapVisible ? (
              <TripPlacesMap
                points={points}
                selected={active?.id || ""}
                onSelect={setSelected}
              />
            ) : (
              <div className="journey-map-placeholder">
                <span className="mono">A CLOSER LOOK</span>
                <button onClick={() => setMapVisible(true)}>
                  展开互动地图 ↗
                </button>
              </div>
            )
          ) : (
            <div className="journey-map-empty">
              <span aria-hidden="true">⊕</span>
              <h3>此刻，不必有坐标。</h3>
              <p>
                照片仍可完整浏览；补充旅行地点或上传带 GPS
                的照片后，地图会自动出现。
              </p>
              <a href={`/travel/manage/?trip=${album.id}`}>补充旅行地点 ↗</a>
            </div>
          )}
          <div className="journey-map-note">
            <span className="mono">OPENSTREETMAP</span>
            <span>点位为记录位置，不代表实际行走路线</span>
          </div>
        </div>
        <aside className="journey-point-panel" aria-label="旅行点位与详情">
          <div className="journey-point-heading">
            <span className="mono">PLACES INDEX</span>
            <span>{String(points.length).padStart(2, "0")}</span>
          </div>
          {points.length > 0 && (
            <ol className="journey-point-list">
              {points.map((point, index) => (
                <li key={point.id}>
                  <button
                    className="journey-point-select"
                    aria-pressed={point.id === active?.id}
                    onClick={() => setSelected(point.id)}
                  >
                    <span className="point-number mono">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{point.label}</strong>
                      <small>
                        {pointSource(point)}
                        {point.photos.length
                          ? ` · ${point.photos.length} 张`
                          : ""}
                      </small>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {active && (
            <div
              className="journey-point-detail"
              key={active.id}
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="eyebrow">SELECTED LOCATION</span>
              <h3>{active.label}</h3>
              <p className="mono point-coordinates">
                {coordinateLabel(active, 5)}
              </p>
              {active.photos.length > 0 && (
                <div className="journey-point-photos">
                  {active.photos.slice(0, 4).map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => onOpen(photo.id)}
                      aria-label={`放大点位照片：${photo.caption || photo.id}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaUrl(config.mediaUrl, photo.thumbnail)}
                        width={photo.width}
                        height={photo.height}
                        alt={photo.caption || "此处拍摄的照片"}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
              {active.photos.length > 4 && (
                <p>
                  此处共 {active.photos.length} 张照片，高清查看器中可继续浏览。
                </p>
              )}
              <a
                className="journey-map-link"
                href={osmPointLink(active)}
                target="_blank"
                rel="noopener noreferrer"
              >
                在地图中探索周边 <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}
          <p className="journey-point-footnote">
            {located
              ? "编号用于检索照片，不表示行程先后。"
              : "照片未记录 GPS；不会用旅行定位代替每张照片的拍摄位置。"}
          </p>
        </aside>
      </div>
    </section>
  );
}
