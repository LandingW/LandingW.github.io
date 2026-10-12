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
  const [status, setStatus] = useState("旅途中的光与片刻，收进一册影集。");
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
                : "第一段旅程，慢慢记录。",
            );
          } catch {
            if (!controller.signal.aborted)
              setStatus("照片预览暂时无法加载，可以进入影集重试。");
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
        <SectionHeading
          number="04"
          english="Away from the screen"
          title="旅行足迹"
        >
          <Link href="/travel/">
            全部旅行与世界地图 <Arrow diagonal />
          </Link>
        </SectionHeading>
        <p className="home-travel-summary" role="status">
          {status}
        </p>
        <p className="home-travel-description">
          换一种方式看见世界。
          <br />
          一些风景，一些留在光里的记忆。
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
          翻开旅行影集 <Arrow diagonal />
        </Link>
      )}
    </section>
  );
}
