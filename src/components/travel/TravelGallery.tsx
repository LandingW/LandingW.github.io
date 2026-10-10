"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import WorldMap from "./WorldMap";
import TripCover from "./TripCover";
import { tripLocation } from "@/lib/trip-presentation";
import {
  EMPTY_MANIFEST,
  mediaUrl,
  parseManifest,
  type TravelConfig,
} from "@/lib/travel";
import { loadTravelConfig } from "@/lib/travel-client";

const PhotoViewer = dynamic(() => import("./PhotoViewer"), { ssr: false });
const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });

export default function TravelGallery() {
  const [manifest, setManifest] = useState(EMPTY_MANIFEST);
  const [config, setConfig] = useState<TravelConfig>({
    apiUrl: "",
    mediaUrl: "",
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [photoId, setPhotoId] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [reload, setReload] = useState(0);
  const collection = useRef<HTMLElement>(null);
  const overviewScroll = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const loaded = await loadTravelConfig();
        if (controller.signal.aborted) return;
        setConfig(loaded);
        if (loaded.mediaUrl) {
          const response = await fetch(`${loaded.mediaUrl}/manifest.json`, {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(12000),
            ]),
            cache: "no-cache",
          });
          if (response.status !== 404) {
            if (!response.ok) throw new Error("相册暂时无法加载");
            const parsed = parseManifest(await response.json());
            if (!controller.signal.aborted) setManifest(parsed);
          }
        }
        const query = new URLSearchParams(window.location.search);
        setSelected(query.get("trip") || "");
        setPhotoId(query.get("photo") || "");
      } catch {
        if (!controller.signal.aborted)
          setError("暂时无法连接相册。可以重试，其他页面不受影响。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    const sync = () => {
      const q = new URLSearchParams(window.location.search);
      setSelected(q.get("trip") || "");
      setPhotoId(q.get("photo") || "");
    };
    window.addEventListener("popstate", sync);
    return () => {
      controller.abort();
      window.removeEventListener("popstate", sync);
    };
  }, [reload]);
  const album = manifest.albums.find((item) => item.id === selected);
  const photos = manifest.photos.filter(
    (item) => !album || item.albumId === album.id,
  );
  const photo = photos.find((item) => item.id === photoId);
  const index = photo ? photos.indexOf(photo) : -1;
  const albumLocation = album ? tripLocation(album, photos) : null;
  function navigate(trip: string, id = "") {
    if (trip === selected && id === photoId) return;
    if (trip && !selected) overviewScroll.current = window.scrollY;
    const url = new URL(window.location.href);
    if (trip) url.searchParams.set("trip", trip);
    else url.searchParams.delete("trip");
    if (id) url.searchParams.set("photo", id);
    else url.searchParams.delete("photo");
    window.history.pushState({}, "", url);
    setSelected(trip);
    setPhotoId(id);
    setShowMap(false);
    if (trip !== selected)
      requestAnimationFrame(() => {
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth";
        if (trip) {
          collection.current?.scrollIntoView({ behavior, block: "start" });
          collection.current
            ?.querySelector<HTMLHeadingElement>(".travel-album-heading h2")
            ?.focus({ preventScroll: true });
        } else {
          window.scrollTo({ top: overviewScroll.current, behavior });
          const previous = [
            ...(collection.current?.querySelectorAll<HTMLAnchorElement>(
              ".trip-card",
            ) || []),
          ].find(
            (card) => new URL(card.href).searchParams.get("trip") === selected,
          );
          previous?.focus({ preventScroll: true });
        }
      });
  }
  return (
    <>
      <section className="travel-intro">
        <div>
          <p className="eyebrow">04 / 旅行</p>
          <h1>
            走过的地方<span className="accent">.</span>
          </h1>
        </div>
        <p>
          光线、风景，与旅途中的片刻。
          <br />
          在地图上回看，在照片里走近。
        </p>
      </section>
      <WorldMap
        albums={manifest.albums}
        photos={manifest.photos}
        mapConfig={config}
        selected={selected}
        onSelect={(id) => navigate(id)}
      />
      <section
        ref={collection}
        className="travel-collection"
        aria-label="旅行影集"
      >
        <div className="travel-filter">
          <div>
            <button
              className={!album ? "is-active" : ""}
              onClick={() => navigate("")}
            >
              全部旅行 <span>{manifest.albums.length}</span>
            </button>
            {album && (
              <span className="trip-breadcrumb">
                <span aria-hidden="true">/</span> {album.title}
              </span>
            )}
          </div>
          <span className="mono">
            {album
              ? `${photos.length} PHOTOS`
              : `${manifest.albums.length} TRIPS`}
          </span>
        </div>
        {album && (
          <div className="travel-album-heading">
            <div>
              <p className="mono">
                {album.date} {album.place && ` / ${album.place}`}
              </p>
              <h2 tabIndex={-1}>{album.title}</h2>
              <p>{album.description}</p>
            </div>
            {(albumLocation || album.googlePlaceId) && (
              <button
                className="travel-text-button"
                onClick={() => setShowMap(!showMap)}
              >
                {showMap ? "收起地图 −" : "查看位置 ↗"}
              </button>
            )}
          </div>
        )}
        {album && showMap && (albumLocation || album.googlePlaceId) && (
          <LocationMap
            key={album.id}
            latitude={albumLocation?.latitude || 0}
            longitude={albumLocation?.longitude || 0}
            place={album.place}
            googlePlaceId={album.googlePlaceId}
            mapConfig={config}
          />
        )}
        {loading ? (
          <p className="travel-empty" role="status">
            正在翻开旅行影集…
          </p>
        ) : error ? (
          <div className="travel-empty" role="alert">
            <h2>稍后再试一次</h2>
            <p>{error}</p>
            <button
              className="travel-button"
              onClick={() => {
                setLoading(true);
                setError("");
                setReload((value) => value + 1);
              }}
            >
              重新加载
            </button>
          </div>
        ) : photos.length === 0 ? (
          <div className="travel-empty">
            <span className="mono">A PLACE FOR MEMORIES</span>
            <h2>照片，慢慢收集。</h2>
            <p>
              旅行影集正在准备中。第一组照片发布后，
              <br />
              这里会留下它们的位置与故事。
            </p>
          </div>
        ) : !album ? (
          <div className="trip-card-grid" key="trips">
            {manifest.albums.map((trip, tripIndex) => {
              const count = manifest.photos.filter(
                (photo) => photo.albumId === trip.id,
              ).length;
              const located = Boolean(
                trip.googlePlaceId || tripLocation(trip, manifest.photos),
              );
              return (
                <a
                  className="trip-card"
                  key={trip.id}
                  href={`?trip=${trip.id}`}
                  onClick={(event) => {
                    if (
                      event.button === 0 &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey
                    ) {
                      event.preventDefault();
                      navigate(trip.id);
                    }
                  }}
                  aria-label={`打开${trip.title}，${count}张照片`}
                >
                  <TripCover
                    album={trip}
                    photos={manifest.photos}
                    mediaBase={config.mediaUrl}
                  />
                  <div className="trip-card-meta">
                    <span className="mono">
                      {String(tripIndex + 1).padStart(2, "0")} /{" "}
                      {trip.date || "旅行记录"}
                    </span>
                    <span>{count} 张照片</span>
                  </div>
                  <div className="trip-card-heading">
                    <h2>{trip.title}</h2>
                    <span className="trip-card-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </div>
                  <p className="trip-card-place">
                    {trip.place ||
                      (trip.googlePlaceId
                        ? "已选择 Google 地点"
                        : located
                          ? "已标记旅行地点"
                          : "地点待补充")}
                  </p>
                  {trip.description && (
                    <p className="trip-card-description">{trip.description}</p>
                  )}
                </a>
              );
            })}
          </div>
        ) : (
          <div className="travel-photo-grid trip-photo-detail" key={album.id}>
            {photos.map((item, i) => (
              <button
                className="travel-photo"
                key={item.id}
                onClick={() => navigate(selected, item.id)}
                aria-label={`放大查看${item.caption || `第 ${i + 1} 张照片`}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(config.mediaUrl, item.thumbnail)}
                  alt={item.caption || "旅行照片"}
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  decoding="async"
                />
                <span>
                  <span>
                    {item.caption ||
                      manifest.albums.find((entry) => entry.id === item.albumId)
                        ?.place ||
                      "旅途片刻"}
                  </span>
                  <span>↗</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="travel-end">
        <Link href="/">← 回到主页</Link>
        <Link href="/travel/privacy/">地图与隐私说明</Link>
        <Link href="/travel/manage/">管理影集</Link>
      </div>
      {photo && (
        <PhotoViewer
          key={photo.id}
          photo={photo}
          mediaBase={config.mediaUrl}
          mapConfig={config}
          position={index}
          count={photos.length}
          onClose={() => navigate(selected)}
          onMove={(direction) =>
            navigate(
              selected,
              photos[(index + direction + photos.length) % photos.length].id,
            )
          }
        />
      )}
    </>
  );
}
