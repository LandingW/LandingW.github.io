"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SectionHeading from "../SectionHeading";
import { Arrow } from "../Icons";
import { loadTravelConfig } from "@/lib/travel-client";
import { EMPTY_MANIFEST, mediaUrl, parseManifest } from "@/lib/travel";
import { tripCoverPhotos } from "@/lib/trip-presentation";

export default function TravelPreview() {
  const section = useRef<HTMLElement>(null);
  const [manifest, setManifest] = useState(EMPTY_MANIFEST);
  const [base, setBase] = useState("");
  const [status, setStatus] = useState("旅行时拍的照片。");
  useEffect(() => {
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void (async () => {
          try {
            const config = await loadTravelConfig();
            if (!config.mediaUrl || controller.signal.aborted) return;
            const response = await fetch(`${config.mediaUrl}/manifest.json`, {
              cache: "no-cache",
              signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(12000),
              ]),
            });
            if (response.status === 404) return;
            if (!response.ok) throw new Error("相册加载失败");
            const data = parseManifest(await response.json());
            if (controller.signal.aborted) return;
            setBase(config.mediaUrl);
            setManifest(data);
            setStatus(
              data.albums.length
                ? `${data.albums.length} 次旅行 · ${new Set(data.photos.map((photo) => photo.id)).size} 张照片`
                : "还没有发布旅行照片。",
            );
          } catch {
            if (!controller.signal.aborted)
              setStatus("照片加载失败，可以打开旅行页重试。");
          }
        })();
      },
      { rootMargin: "600px" },
    );
    if (section.current) observer.observe(section.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, []);
  return (
    <section id="travel" ref={section} className="home-travel">
      <div className="home-travel-intro">
        <SectionHeading number="04" english="Travel" title="旅行">
          <Link href="/travel/">
            全部旅行 <Arrow diagonal />
          </Link>
        </SectionHeading>
        <p className="home-travel-summary" role="status">
          {status}
        </p>
        <p className="home-travel-description">
          按旅行整理了照片和地点，点进去可以看大图。
        </p>
      </div>
      {manifest.albums.length > 0 ? (
        <div className="home-travel-grid">
          {manifest.albums.slice(0, 2).map((album, index) => {
            const photo = tripCoverPhotos(album, manifest.photos)[0];
            return (
              <Link
                className="home-trip"
                data-reveal
                data-reveal-index={index}
                data-motion-card
                key={album.id}
                href={`/travel/?trip=${album.id}`}
              >
                {photo && (
                  <div className="home-trip-image">
                    <picture>
                      <source
                        media="(min-width: 761px)"
                        srcSet={mediaUrl(base, photo.preview)}
                      />
                      <img
                        src={mediaUrl(base, photo.thumbnail)}
                        width={photo.width}
                        height={photo.height}
                        alt={album.title}
                        loading="lazy"
                        decoding="async"
                      />
                    </picture>
                  </div>
                )}
                <div className="home-trip-caption">
                  <div>
                    <span className="mono">
                      {album.date || "旅行记录"}
                      {album.place ? ` / ${album.place}` : ""}
                    </span>
                    <h3>{album.title}</h3>
                  </div>
                  <Arrow diagonal />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Link className="home-travel-empty" href="/travel/">
          查看旅行照片 <Arrow diagonal />
        </Link>
      )}
    </section>
  );
}
