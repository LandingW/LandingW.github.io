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
import { normalizeLocation, shootingSummary } from "@/lib/photo-metadata";
import { tripTransitionName } from "@/lib/ui-motion";
import { coordinateLabel } from "@/lib/trip-atlas";
import TripAtlas from "./TripAtlas";
import TripChapterNav from "./TripChapterNav";
import TripEquipment from "./TripEquipment";

const CountryOutline = dynamic(() => import("./CountryOutline"), {
  loading: () => (
    <figure
      className="journey-country country-skeleton"
      role="status"
      aria-label="正在展开目的地轮廓"
    >
      <div className="country-caption">
        <span className="mono">DESTINATION / ATLAS</span>
        <span aria-hidden="true">↗</span>
      </div>
      <svg
        className="country-outline"
        viewBox="0 0 360 294"
        aria-hidden="true"
      />
      <figcaption>
        <span>
          <strong>目的地轮廓</strong>
          <em>Loading…</em>
        </span>
      </figcaption>
      <p className="country-provenance">正在读取本地地理数据…</p>
      <div className="country-coordinates mono">—</div>
    </figure>
  ),
});

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
  const [coverReady, setCoverReady] = useState(false);
  const coverImageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setCoverReady(true);
  }, []);
  const cover = tripCoverPhotos(album, photos)[0];
  const location = normalizeLocation(tripLocation(album, photos));
  const remaining = photos.filter((photo) => photo.id !== cover?.id);
  return (
    <article className="trip-story journey-story" id="story-top">
      <div className="story-breadcrumb">
        <button onClick={onBack}>← 全部旅行</button>
        <span className="mono">FIELD NOTES / {album.date || "旅行记录"}</span>
      </div>
      <header className="story-opening journey-opening">
        <div className="story-title-block">
          <div className="story-title-copy">
            <p className="eyebrow">
              <span className="status-dot" /> FIELD JOURNAL / 旅行手记
            </p>
            <h1 tabIndex={-1}>
              {album.title}
              <span className="accent">.</span>
            </h1>
            {album.place && (
              <p className="journey-destination">{album.place}</p>
            )}
            {album.description && (
              <p className="story-description">{album.description}</p>
            )}
          </div>
          <div className="story-detail-aside">
            <dl className="story-facts">
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
            <a className="story-read-link" href="#story-places">
              探索这段旅程 <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <div
          className="journey-cover-composition"
          data-has-cover={Boolean(cover)}
        >
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
                <span className="mono">
                  {location
                    ? coordinateLabel(location)
                    : "LIGHT / PLACE / MEMORY"}
                </span>
                <span>高清查看 ↗</span>
              </span>
            </button>
          )}
          <aside className="journey-cover-aside">
            <CountryOutline location={location} place={album.place} />
            <div className="journey-cover-note">
              <span className="mono">A MOMENT, SOMEWHERE.</span>
              <p>
                把看见的风景，
                <br />
                留在抵达的地方。
              </p>
              <a href="#story-frames">
                {String(photos.length).padStart(2, "0")} 张影像记录{" "}
                <span aria-hidden="true">↘</span>
              </a>
            </div>
          </aside>
        </div>
      </header>
      <TripChapterNav />
      <TripAtlas
        album={album}
        photos={photos}
        config={config}
        onOpen={onOpen}
      />
      <section
        className="journey-section journey-photographs"
        id="story-frames"
        aria-labelledby="frames-title"
      >
        <header className="journey-section-heading" data-reveal>
          <div>
            <p className="eyebrow">02 / COLLECTED MOMENTS</p>
            <h2 id="frames-title">
              沿途的光<span className="accent">.</span>
            </h2>
          </div>
          <p>
            停下来，再看一眼。
            <br />
            点击照片，逐层展开高清细节。
          </p>
        </header>
        <div className="story-toolbar">
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
        </div>
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
      </section>
      <TripEquipment photos={photos} />
      <footer className="story-colophon" data-reveal>
        <span className="mono">END OF THIS JOURNEY</span>
        <h2>
          把片刻，留在这里<span className="accent">.</span>
        </h2>
        <button className="travel-text-button" onClick={onBack}>
          继续看其他旅行 ↗
        </button>
      </footer>
    </article>
  );
}
