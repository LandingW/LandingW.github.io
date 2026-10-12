"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import WorldMap from "./WorldMap";
import TripCover from "./TripCover";
import TripStory from "./TripStory";
import { EMPTY_MANIFEST, parseManifest, type TravelConfig } from "@/lib/travel";
import { loadTravelConfig } from "@/lib/travel-client";

const PhotoViewer = dynamic(() => import("./PhotoViewer"), { ssr: false });

export default function TravelGallery() {
  const [manifest, setManifest] = useState(EMPTY_MANIFEST);
  const [config, setConfig] = useState<TravelConfig>({
    apiUrl: "",
    mediaUrl: "",
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState(""),
    [photoId, setPhotoId] = useState("");
  const [reload, setReload] = useState(0);
  const collection = useRef<HTMLElement>(null);
  const overviewScroll = useRef(0);
  const lightboxPushed = useRef(false);
  const transition = useRef<ViewTransition | null>(null);
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
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const sync = () => {
      lightboxPushed.current = false;
      const query = new URLSearchParams(window.location.search);
      flushSync(() => {
        setSelected(query.get("trip") || "");
        setPhotoId(query.get("photo") || "");
      });
      if (!query.get("trip"))
        window.scrollTo({ top: overviewScroll.current, behavior: "instant" });
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const album = manifest.albums.find((item) => item.id === selected);
  const photos = manifest.photos.filter(
    (item) => !album || item.albumId === album.id,
  );
  const photo = photos.find((item) => item.id === photoId);
  const index = photo ? photos.indexOf(photo) : -1;

  function navigate(trip: string, id = "") {
    if (trip === selected && id === photoId) return;
    if (photoId && !id && trip === selected && lightboxPushed.current) {
      lightboxPushed.current = false;
      window.history.back();
      return;
    }
    if (trip && !selected) overviewScroll.current = window.scrollY;
    const update = () => {
      const url = new URL(window.location.href);
      if (trip) url.searchParams.set("trip", trip);
      else url.searchParams.delete("trip");
      if (id) url.searchParams.set("photo", id);
      else url.searchParams.delete("photo");
      if (photoId && trip === selected)
        window.history.replaceState({}, "", url);
      else {
        window.history.pushState({}, "", url);
        if (id) lightboxPushed.current = true;
      }
      flushSync(() => {
        setSelected(trip);
        setPhotoId(id);
      });
      if (trip !== selected) {
        if (trip) {
          window.scrollTo({ top: 0, behavior: "instant" });
          collection.current
            ?.querySelector<HTMLElement>("h1")
            ?.focus({ preventScroll: true });
        } else {
          window.scrollTo({ top: overviewScroll.current, behavior: "instant" });
          collection.current
            ?.querySelector<HTMLAnchorElement>(`a[data-trip="${selected}"]`)
            ?.focus({ preventScroll: true });
        }
      }
    };
    if (
      trip !== selected &&
      document.startViewTransition &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      transition.current?.skipTransition();
      transition.current = document.startViewTransition(update);
      void transition.current.finished.catch(() => {});
    } else update();
  }
  return (
    <>
      {!album && !loading && (
        <>
          <section className="travel-intro">
            <div>
              <p className="eyebrow">04 / FIELD NOTES</p>
              <h1>
                走过的地方<span className="accent">.</span>
              </h1>
            </div>
            <div className="travel-intro-aside">
              <p>
                不赶路的时候，看见更多。
                <br />
                一些风景，一些留在光里的片刻。
              </p>
              <Link href="/travel/manage/">记录一次旅行 ↗</Link>
            </div>
          </section>
          <div className="travel-atlas-layout">
            <aside className="travel-atlas-intro">
              <span className="eyebrow">THE TRAVEL INDEX</span>
              <h2>
                Places,
                <br />
                <em>remembered.</em>
              </h2>
              <p>
                在地图上回看，
                <br />
                在照片里走近。
              </p>
              <dl>
                <div>
                  <dt>旅行手记</dt>
                  <dd>{String(manifest.albums.length).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>影像记录</dt>
                  <dd>{String(manifest.photos.length).padStart(2, "0")}</dd>
                </div>
              </dl>
            </aside>
            <WorldMap
              albums={manifest.albums}
              photos={manifest.photos}
              mapConfig={config}
              selected={selected}
              onSelect={(id) => navigate(id)}
            />
          </div>
        </>
      )}
      <section
        ref={collection}
        className="travel-collection"
        aria-label="旅行影集"
      >
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
        ) : album ? (
          <TripStory
            key={album.id}
            album={album}
            photos={photos}
            config={config}
            onOpen={(id) => navigate(selected, id)}
            onBack={() => navigate("")}
          />
        ) : (
          <>
            <div className="travel-filter">
              <h2>
                旅行手记{" "}
                <span className="mono">
                  / {String(manifest.albums.length).padStart(2, "0")}
                </span>
              </h2>
              <span className="mono">PLACES & MEMORIES</span>
            </div>
            {manifest.albums.length === 0 ? (
              <div className="travel-empty">
                <span className="mono">A PLACE FOR MEMORIES</span>
                <h2>照片，慢慢收集。</h2>
                <p>第一组照片发布后，这里会留下它们的位置与故事。</p>
              </div>
            ) : (
              <div className="trip-card-grid">
                {manifest.albums.map((trip, tripIndex) => {
                  const count = manifest.photos.filter(
                    (item) => item.albumId === trip.id,
                  ).length;
                  return (
                    <a
                      className="trip-card"
                      data-reveal
                      data-reveal-index={tripIndex % 2}
                      data-motion-card
                      key={trip.id}
                      data-trip={trip.id}
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
                        sharedTransition
                      />
                      <div className="trip-card-copy">
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
                        {trip.place && (
                          <p className="trip-card-place">{trip.place}</p>
                        )}
                        {trip.description && (
                          <p className="trip-card-description">
                            {trip.description}
                          </p>
                        )}
                        <span className="trip-card-cta">
                          翻开这段旅程 <span aria-hidden="true">↗</span>
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
      <div className="travel-end">
        <Link href="/">← 回到主页</Link>
        <Link href="/travel/privacy/">地图与隐私说明</Link>
        <Link href="/travel/manage/">管理影集</Link>
      </div>
      {photo && (
        <PhotoViewer
          photo={photo}
          mediaBase={config.mediaUrl}
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
