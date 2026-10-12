"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { mapCoordinates, type TripPoint } from "@/lib/trip-atlas";

export default function TripPlacesMap({
  points,
  selected,
  onSelect,
}: {
  points: TripPoint[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const callbacks = useRef({ onSelect });
  const fit = useRef<() => void>(() => {});
  const active = useRef(selected);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [retry, setRetry] = useState(0);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    callbacks.current = { onSelect };
  }, [onSelect]);
  useEffect(() => {
    active.current = selected;
    for (const [id, marker] of markers.current) {
      marker.getElement()?.classList.toggle("is-active", id === selected);
      marker
        .getElement()
        ?.setAttribute("aria-pressed", String(id === selected));
    }
    const marker = markers.current.get(selected);
    if (marker && map.current) {
      const animate =
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        document.documentElement.dataset.motion !== "reduced";
      map.current.stop();
      map.current.flyTo(
        marker.getLatLng(),
        Math.max(map.current.getZoom(), 12),
        { animate, duration: 0.85 },
      );
    }
  }, [selected]);
  useEffect(() => {
    if (!container.current || !points.length) return;
    let disposed = false;
    const element = container.current;
    const pointMarkers = markers.current;
    let resize: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed) return;
        const instance = L.map(element, {
          scrollWheelZoom: false,
          zoomControl: false,
        });
        map.current = instance;
        L.control.zoom({ position: "bottomright" }).addTo(instance);
        const coordinates = mapCoordinates(points);
        fit.current = () => {
          instance.stop();
          instance.fitBounds(L.latLngBounds(coordinates), {
            padding: [48, 48],
            maxZoom: 12,
            animate: false,
          });
        };
        fit.current();
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          },
        ).addTo(instance);
        tiles.on("tileerror", () => {
          if (!disposed) setTileError(true);
        });
        points.forEach((point, index) => {
          const marker = L.marker(coordinates[index], {
            title: point.label,
            keyboard: true,
            icon: L.divIcon({
              className: `journey-map-pin${point.id === active.current ? " is-active" : ""}`,
              html: `<span>${String(index + 1).padStart(2, "0")}</span>`,
              iconSize: [44, 44],
              iconAnchor: [22, 36],
            }),
          }).addTo(instance);
          const node = marker.getElement();
          if (node) {
            node.setAttribute("role", "button");
            node.setAttribute(
              "aria-label",
              `选择点位 ${index + 1}：${point.label}`,
            );
            node.setAttribute(
              "aria-pressed",
              String(point.id === active.current),
            );
            node.addEventListener("keydown", (event) => {
              if (event.key === " ") {
                event.preventDefault();
                callbacks.current.onSelect(point.id);
              }
            });
          }
          marker.on("click", () => callbacks.current.onSelect(point.id));
          // Text nodes avoid interpreting captions as HTML in Leaflet's tooltips.
          const tooltip = document.createElement("span");
          tooltip.textContent = point.label;
          marker.bindTooltip(tooltip, { direction: "top", offset: [0, -26] });
          pointMarkers.set(point.id, marker);
        });
        resize = new ResizeObserver(() =>
          instance.invalidateSize({ pan: false }),
        );
        resize.observe(element);
        setState("ready");
      })
      .catch(() => {
        if (!disposed) setState("failed");
      });
    return () => {
      disposed = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
      pointMarkers.clear();
      fit.current = () => {};
    };
  }, [points, retry]);
  return (
    <div className="journey-map-shell">
      <div
        ref={container}
        className="journey-map"
        role="region"
        aria-label="旅行详细地图，可选择编号点位"
      />
      {state === "ready" && (
        <button className="journey-map-fit" onClick={() => fit.current()}>
          ⊕ 全部点位
        </button>
      )}
      {state === "loading" && (
        <p className="journey-map-state" role="status">
          正在展开地图…
        </p>
      )}
      {state === "failed" && (
        <div className="journey-map-state" role="status">
          <p>互动地图暂时无法加载，仍可从点位卡打开地图。</p>
          <button
            onClick={() => {
              setState("loading");
              setRetry((value) => value + 1);
            }}
          >
            重试地图
          </button>
        </div>
      )}
      {tileError && (
        <p className="journey-tile-error" role="status">
          部分地图瓦片未能加载。
          <button
            onClick={() => {
              setTileError(false);
              setState("loading");
              setRetry((value) => value + 1);
            }}
          >
            重试
          </button>
        </p>
      )}
      {points.some((point) => Math.abs(point.latitude) > 85) && (
        <p>极区地图按可显示纬度定位，原始坐标保留。</p>
      )}
    </div>
  );
}
