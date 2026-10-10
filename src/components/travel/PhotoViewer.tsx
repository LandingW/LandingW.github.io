"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type OpenSeadragon from "openseadragon";
import { mediaUrl, type TravelPhoto } from "@/lib/travel";
import { cameraName, shootingSummary } from "@/lib/photo-metadata";
import PhotoFacts from "./PhotoFacts";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });

export default function PhotoViewer({
  photo,
  mediaBase,
  position,
  count,
  onClose,
  onMove,
}: {
  photo: TravelPhoto;
  mediaBase: string;
  position: number;
  count: number;
  onClose: () => void;
  onMove: (direction: number) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const viewer = useRef<OpenSeadragon.Viewer | null>(null);
  const [status, setStatus] = useState("正在加载高清切片…");
  const [drawn, setDrawn] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    void import("openseadragon")
      .then(({ default: OSD }) => {
        if (disposed || !stage.current) return;
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const instance = OSD({
          element: stage.current,
          tileSources: mediaUrl(mediaBase, photo.dzi),
          showNavigationControl: false,
          showNavigator: false,
          showSequenceControl: false,
          maxZoomPixelRatio: 2,
          visibilityRatio: 0.8,
          constrainDuringPan: true,
          animationTime: reduced ? 0 : 0.22,
          blendTime: reduced ? 0 : 0.12,
          maxImageCacheCount: 100,
          imageLoaderLimit: 4,
          drawer: "canvas",
          gestureSettingsMouse: {
            clickToZoom: false,
            dblClickToZoom: true,
            scrollToZoom: true,
          },
          gestureSettingsTouch: {
            pinchToZoom: true,
            flickEnabled: true,
            dblClickToZoom: true,
          },
        });
        viewer.current = instance;
        instance.addOnceHandler("tile-drawn", () => setDrawn(true));
        instance.addHandler("open", () =>
          setStatus("滚轮或双指缩放 · 拖动查看细节"),
        );
        instance.addHandler("open-failed", () =>
          setStatus("高清切片暂时无法加载，仍可查看预览图"),
        );
        instance.addHandler("tile-load-failed", () =>
          setStatus("部分高清细节加载失败，请稍后重试"),
        );
      })
      .catch(() => setStatus("高清查看器暂不可用，仍可查看预览图"));
    return () => {
      disposed = true;
      viewer.current?.destroy();
      viewer.current = null;
    };
  }, [mediaBase, photo.dzi]);
  return createPortal(
    <div
      ref={dialog}
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || "高清照片"}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        if (!(event.target as HTMLElement).closest(".photo-info-panel")) {
          if (event.key === "ArrowLeft") onMove(-1);
          if (event.key === "ArrowRight") onMove(1);
        }
        if (event.key === "Tab") {
          const buttons = [
            ...dialog.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex='0']",
            ),
          ].filter((element) => element.getClientRects().length > 0);
          const first = buttons[0],
            last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div className="viewer-top">
        <span className="mono">
          {String(position + 1).padStart(2, "0")} /{" "}
          {String(count).padStart(2, "0")}
        </span>
        <span>
          {photo.width.toLocaleString()} × {photo.height.toLocaleString()}
        </span>
        <div className="viewer-top-actions">
          <button
            onClick={() => setShowInfo(!showInfo)}
            aria-expanded={showInfo}
            aria-controls="photo-info-panel"
          >
            拍摄信息
          </button>
          <button ref={closeButton} onClick={onClose}>
            关闭 ×
          </button>
        </div>
      </div>
      <div className="viewer-image-area">
        {/* The preview remains below the tiled renderer during slow or failed requests. */}
        {!drawn && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="viewer-preview"
            src={mediaUrl(mediaBase, photo.preview)}
            alt={photo.caption || "旅行照片预览"}
          />
        )}
        <div
          className="viewer-stage"
          ref={stage}
          aria-label="可缩放的照片区域"
        />
        {showInfo && (
          <aside
            id="photo-info-panel"
            className="photo-info-panel"
            aria-label="摄影参数和拍摄地点"
          >
            <h2>拍摄信息</h2>
            <PhotoFacts camera={photo.camera} />
            {photo.location ? (
              <>
                <p className="photo-gps mono">
                  GPS {photo.location.latitude.toFixed(6)},{" "}
                  {photo.location.longitude.toFixed(6)}
                </p>
                <LocationMap
                  latitude={photo.location.latitude}
                  longitude={photo.location.longitude}
                  place="照片拍摄位置"
                />
              </>
            ) : (
              <p className="photo-facts-empty">这张照片没有公开的位置记录。</p>
            )}
          </aside>
        )}
      </div>
      <div className="viewer-bottom">
        <div className="viewer-caption">
          <p>{photo.caption}</p>
          {photo.camera && (
            <>
              {(cameraName(photo.camera) || photo.camera.lens) && (
                <p className="viewer-camera">
                  {[cameraName(photo.camera), photo.camera.lens]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
              )}
              <p className="viewer-settings mono">
                {shootingSummary(photo.camera)}
              </p>
            </>
          )}
          <p className="viewer-status" role="status">
            {status}
          </p>
        </div>
        <div className="viewer-controls">
          <button
            onClick={() => onMove(-1)}
            disabled={count < 2}
            aria-label="上一张照片"
          >
            ←
          </button>
          <button
            onClick={() => viewer.current?.viewport.goHome()}
            aria-label="适合屏幕"
          >
            适屏
          </button>
          <button
            onClick={() => {
              const v = viewer.current;
              if (v) v.viewport.zoomTo(v.viewport.imageToViewportZoom(1));
            }}
          >
            1:1
          </button>
          <button
            onClick={() => viewer.current?.viewport.zoomBy(1.5)}
            aria-label="放大照片"
          >
            ＋
          </button>
          <button
            onClick={() => viewer.current?.viewport.zoomBy(1 / 1.5)}
            aria-label="缩小照片"
          >
            −
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={count < 2}
            aria-label="下一张照片"
          >
            →
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
