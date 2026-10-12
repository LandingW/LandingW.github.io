"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type OpenSeadragon from "openseadragon";
import { mediaUrl, type TravelPhoto, type TravelConfig } from "@/lib/travel";
import {
  cameraName,
  lensName,
  lensSpecificationLabel,
  shootingSummary,
} from "@/lib/photo-metadata";
import PhotoFacts from "./PhotoFacts";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });

export default function PhotoViewer({
  photo,
  mediaBase,
  position,
  count,
  onClose,
  onMove,
  mapConfig,
}: {
  photo: TravelPhoto;
  mediaBase: string;
  position: number;
  count: number;
  onClose: () => void;
  onMove: (direction: number) => void;
  mapConfig?: TravelConfig;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const viewer = useRef<OpenSeadragon.Viewer | null>(null);
  const [instance, setInstance] = useState<OpenSeadragon.Viewer | null>(null);
  const [status, setStatus] = useState("正在加载高清切片…");
  const [drawnSource, setDrawnSource] = useState("");
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const deviceLine = [
    cameraName(photo.camera),
    lensName(photo.camera) ||
      (photo.camera?.lensSpec
        ? `${lensSpecificationLabel(photo.camera.lensSpec)}（规格）`
        : ""),
  ]
    .filter(Boolean)
    .join(" / ");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
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
        instance.addHandler("close", () => setDrawnSource(""));
        setInstance(instance);
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
  }, [mediaBase]);
  useEffect(() => {
    if (!instance) return;
    const drawn = () => setDrawnSource(photo.dzi);
    instance.close();
    instance.addOnceHandler("tile-drawn", drawn);
    instance.open({ tileSource: mediaUrl(mediaBase, photo.dzi) });
    return () => instance.removeHandler("tile-drawn", drawn);
  }, [instance, mediaBase, photo.dzi]);
  function requestClose() {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 170);
  }
  return createPortal(
    <div
      ref={dialog}
      className={`photo-viewer${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || "高清照片"}
      onKeyDown={(event) => {
        if (closing) return;
        if (event.key === "Escape") requestClose();
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
          <button ref={closeButton} onClick={requestClose}>
            关闭 ×
          </button>
        </div>
      </div>
      <div className="viewer-image-area">
        {/* The preview remains below the tiled renderer during slow or failed requests. */}
        {drawnSource !== photo.dzi && (
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
            <PhotoFacts
              camera={photo.camera}
              sources={photo.equipmentSources}
            />
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
                  mapConfig={mapConfig}
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
              {deviceLine && <p className="viewer-camera">{deviceLine}</p>}
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
