"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
      正在加载地图…
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
  const stopCount = album.stops?.length || 0;
  const [selected, setSelected] = useState(points[0]?.id || "");
  const [mapVisible, setMapVisible] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const pointPickerId = useId();
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
          <p className="eyebrow">01 / {stopCount ? "ROUTE" : "MAP"}</p>
          <h2 id="places-title">
            {stopCount ? "行程地点" : "地点"}
            <span className="accent">.</span>
          </h2>
        </div>
        <p>
          {points.length
            ? `${points.length} 个地点 · ${located} 张照片带 GPS`
            : "这次旅行还没有公开的位置记录。"}
        </p>
      </header>
      <div
        className="journey-atlas-layout"
        ref={container}
        data-has-points={points.length > 0}
      >
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
                <span className="mono">地点地图</span>
                <button onClick={() => setMapVisible(true)}>加载地图 ↗</button>
              </div>
            )
          ) : (
            <div className="journey-map-empty">
              <span aria-hidden="true">⊕</span>
              <h3>还没有位置记录</h3>
              <p>添加旅行地点或公开照片 GPS 后，这里会显示地图。</p>
              <a href={`/travel/manage/?trip=${album.id}`}>补充旅行地点 ↗</a>
            </div>
          )}
          <div className="journey-map-note">
            <span className="mono">OPENSTREETMAP</span>
            <span>
              {stopCount > 1
                ? "弧线表示站点顺序，不代表实际行走或导航路线"
                : "点位为记录位置，不代表实际行走路线"}
            </span>
          </div>
        </div>
        {active && (
          <aside className="journey-point-panel" aria-label="旅行点位与详情">
            <div className="journey-point-heading">
              <span className="mono">地点列表</span>
              <span>{String(points.length).padStart(2, "0")}</span>
            </div>
            {points.length > 1 && (
              <div className="journey-point-picker">
                <label htmlFor={pointPickerId}>切换点位</label>
                <select
                  id={pointPickerId}
                  value={active.id}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {points.map((point, index) => (
                    <option key={point.id} value={point.id}>
                      {String(index + 1).padStart(2, "0")} · {point.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {points.length > 1 && (
              <ol
                className={`journey-point-list${stopCount ? " journey-route-list" : ""}`}
              >
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
                <span className="eyebrow">{pointSource(active)}</span>
                <h3>{active.label}</h3>
                {active.note && (
                  <p className="journey-stop-note">{active.note}</p>
                )}
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
                  <p>这里拍了 {active.photos.length} 张照片。</p>
                )}
                <a
                  className="journey-map-link"
                  href={osmPointLink(active)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  在 OpenStreetMap 中查看 <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}
            <p className="journey-point-footnote">
              {stopCount
                ? "行程按保存顺序连线，照片 GPS 另行标记。"
                : located
                  ? "编号用于检索照片，不表示行程先后。"
                  : "这是旅行的位置；照片未记录 GPS，无法确定各张的拍摄地点。"}
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}
