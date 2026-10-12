"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import {
  mediaUrl,
  type TravelAlbum,
  type TravelConfig,
  type TravelPhoto,
} from "@/lib/travel";
import { tripCoverPhotos, tripLocation } from "@/lib/trip-presentation";
import { cameraName, shootingSummary } from "@/lib/photo-metadata";
import { tripTransitionName } from "@/lib/ui-motion";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });

export default function TripStory({
  album,
  photos,
  config,
  onOpen,
  onBack,
}: {
  album: TravelAlbum;
  photos: TravelPhoto[];
  config: TravelConfig;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const [view, setView] = useState<"story" | "index">("story");
  const [showMap, setShowMap] = useState(false);
  const [coverReady, setCoverReady] = useState(false);
  const coverImageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setCoverReady(true);
  }, []);
  const cover = tripCoverPhotos(album, photos)[0];
  const location = tripLocation(album, photos);
  const devices = [
    ...new Set(photos.map((photo) => cameraName(photo.camera)).filter(Boolean)),
  ];
  const remaining = photos.filter((photo) => photo.id !== cover?.id);
  return (
    <article className="trip-story">
      <div className="story-breadcrumb">
        <button onClick={onBack}>← 全部旅行</button>
        <span className="mono">FIELD NOTES / {album.date || "旅行记录"}</span>
      </div>
      <header className="story-opening">
        <div className="story-title-block">
          <p className="eyebrow">
            <span className="status-dot" /> 旅行手记
          </p>
          <h1 tabIndex={-1}>
            {album.title}
            <span className="accent">.</span>
          </h1>
          {album.description && (
            <p className="story-description">{album.description}</p>
          )}
          <dl className="story-facts">
            {album.place && (
              <div>
                <dt>目的地</dt>
                <dd>{album.place}</dd>
              </div>
            )}
            {album.date && (
              <div>
                <dt>旅行日期</dt>
                <dd className="mono">{album.date}</dd>
              </div>
            )}
            <div>
              <dt>影像记录</dt>
              <dd>{String(photos.length).padStart(2, "0")} 张照片</dd>
            </div>
          </dl>
          <a className="story-read-link" href="#story-frames">
            翻开这段旅程 <span aria-hidden="true">↓</span>
          </a>
        </div>
        {cover && (
          <button
            className="story-cover-photo"
            data-cover-ready={coverReady}
            style={{ viewTransitionName: tripTransitionName(album.id) }}
            onClick={() => onOpen(cover.id)}
            aria-label="放大查看旅行封面"
          >
            {/* Keep the already-cached card image visible during the shared transition. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="story-cover-preview"
              src={mediaUrl(config.mediaUrl, cover.thumbnail)}
              width={cover.width}
              height={cover.height}
              alt=""
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={coverImageRef}
              className="story-cover-sharp"
              onLoad={() => setCoverReady(true)}
              src={mediaUrl(config.mediaUrl, cover.preview)}
              alt={cover.caption || album.title}
              width={cover.width}
              height={cover.height}
              fetchPriority="high"
            />
            <span className="story-cover-label">
              <span>光线 · 地点 · 片刻</span>
              <span>高清查看 ↗</span>
            </span>
          </button>
        )}
      </header>
      <div className="story-toolbar" id="story-frames">
        <span className="mono">
          {String(photos.length).padStart(2, "0")} FRAMES
        </span>
        <div className="story-view-switch" aria-label="照片排版">
          <button
            aria-pressed={view === "story"}
            onClick={() => setView("story")}
          >
            手记
          </button>
          <button
            aria-pressed={view === "index"}
            onClick={() => setView("index")}
          >
            照片索引
          </button>
        </div>
        {location && (
          <button
            className="story-map-toggle"
            onClick={() => setShowMap(!showMap)}
            aria-expanded={showMap}
          >
            {showMap ? "收起地图 −" : "旅行地点 ↗"}
          </button>
        )}
      </div>
      {showMap && location && (
        <LocationMap
          latitude={location?.latitude || 0}
          longitude={location?.longitude || 0}
          place={album.place}
        />
      )}
      <div
        className={view === "index" ? "story-contact-sheet" : "story-frames"}
        key={view}
      >
        {(view === "index"
          ? photos
          : remaining.length
            ? remaining
            : photos
        ).map((photo, index) => (
          <figure
            className={`story-frame ${index % 5 === 2 ? "is-wide" : ""} ${photo.height > photo.width ? "is-portrait" : ""}`}
            key={photo.id}
            data-reveal
            data-reveal-index={index % 2}
          >
            <button
              onClick={() => onOpen(photo.id)}
              aria-label={`放大查看第 ${photos.indexOf(photo) + 1} 张照片${photo.caption ? `：${photo.caption}` : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(
                  config.mediaUrl,
                  view === "index" ? photo.thumbnail : photo.preview,
                )}
                alt={photo.caption || `旅行影像 ${photos.indexOf(photo) + 1}`}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
              />
              <span className="frame-open" aria-hidden="true">
                ↗
              </span>
            </button>
            <figcaption>
              <span className="mono">
                {String(photos.indexOf(photo) + 1).padStart(2, "0")}
              </span>
              <span>{photo.caption || shootingSummary(photo.camera)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <footer className="story-colophon" data-reveal>
        <span className="mono">END OF THIS JOURNEY</span>
        <h2>
          把片刻，留在这里<span className="accent">.</span>
        </h2>
        {devices.length > 0 && <p>拍摄设备 / {devices.join(" · ")}</p>}
        <button className="travel-text-button" onClick={onBack}>
          继续看其他旅行 ↗
        </button>
      </footer>
    </article>
  );
}
