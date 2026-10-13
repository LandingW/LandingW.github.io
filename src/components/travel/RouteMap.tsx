"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { mapCoordinates } from "@/lib/trip-atlas";
import { routeArcs, type TripStop } from "@/lib/trip-route";
import { normalizeLocation, type PhotoLocation } from "@/lib/photo-metadata";
import { setMapInteraction, TOUCH_MAP_QUERY } from "@/lib/map-interaction";
import { useMediaQuery } from "@/lib/use-media-query";

interface Props {
  stops: TripStop[];
  selected: string;
  anchor: PhotoLocation | null;
  placing: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  onAdd: (point: PhotoLocation) => void;
  onMove: (id: string, point: PhotoLocation) => void;
}

export default function RouteMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pins = useRef(new Map<string, Marker>());
  const current = useRef(props);
  const redraw = useRef<() => void>(() => {});
  const fit = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const touch = useMediaQuery(TOUCH_MAP_QUERY);
  const locked = props.disabled || (touch && !interacting && !props.placing);
  const allow = useRef(!locked);
  const id = useId();
  useEffect(() => {
    current.current = props;
    redraw.current();
  }, [props]);
  useEffect(() => {
    allow.current = !locked;
    if (map.current) setMapInteraction(map.current, !locked);
    for (const marker of pins.current.values()) {
      if (locked) marker.dragging?.disable();
      else marker.dragging?.enable();
    }
  }, [locked, props.stops]);
  useEffect(() => {
    const marker = pins.current.get(props.selected);
    if (marker && map.current) {
      map.current.stop();
      map.current.flyTo(
        marker.getLatLng(),
        Math.max(13, map.current.getZoom()),
        {
          animate: !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          duration: 0.65,
        },
      );
    }
  }, [props.selected]);
  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    const element = container.current;
    const markers = pins.current;
    let observer: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed) return;
        const instance = L.map(element, {
          scrollWheelZoom: false,
          zoomControl: false,
        });
        map.current = instance;
        setMapInteraction(instance, allow.current);
        L.control.zoom({ position: "bottomright" }).addTo(instance);
        const anchor = normalizeLocation(current.current.anchor);
        instance.setView(
          anchor
            ? [Math.max(-85, Math.min(85, anchor.latitude)), anchor.longitude]
            : [25, 0],
          anchor ? 12 : 2,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        })
          .addTo(instance)
          .on("tileerror", () => {
            if (!disposed) setFailed(true);
          });
        const lines = L.layerGroup().addTo(instance);
        function renderLines() {
          lines.clearLayers();
          const coordinates = current.current.stops
            .map((stop) => markers.get(stop.id)?.getLatLng())
            .filter((p) => !!p)
            .map((p): [number, number] => [p.lat, p.lng]);
          for (const arc of routeArcs(coordinates)) {
            L.polyline(arc, {
              color: "#f7f5ef",
              weight: 7,
              interactive: false,
            }).addTo(lines);
            L.polyline(arc, {
              color: "#a45038",
              weight: 2,
              dashArray: "6 8",
              interactive: false,
            }).addTo(lines);
          }
        }
        const rounded = (lat: number, lon: number) => ({
          latitude: Math.round(Math.max(-85, Math.min(85, lat)) * 1e6) / 1e6,
          longitude:
            Math.round((((((lon + 180) % 360) + 360) % 360) - 180) * 1e6) / 1e6,
        });
        redraw.current = () => {
          const state = current.current;
          const coordinates = mapCoordinates(state.stops);
          for (const [id, pin] of markers) {
            if (!state.stops.some((stop) => stop.id === id)) {
              pin.remove();
              markers.delete(id);
            }
          }
          state.stops.forEach((stop, index) => {
            let marker = markers.get(stop.id);
            const icon = L.divIcon({
              className: `journey-map-pin route-edit-pin${state.selected === stop.id ? " is-active" : ""}`,
              html: `<span>${String(index + 1).padStart(2, "0")}</span>`,
              iconSize: [44, 44],
              iconAnchor: [22, 36],
            });
            if (marker) {
              marker.setLatLng(coordinates[index]);
              marker.setIcon(icon);
            } else {
              marker = L.marker(coordinates[index], {
                icon,
                draggable: allow.current,
                keyboard: true,
              }).addTo(instance);
              const pin = marker;
              pin.on("click", () => current.current.onSelect(stop.id));
              pin.on("drag", renderLines);
              pin.on("dragend", () => {
                const point = pin.getLatLng();
                current.current.onMove(stop.id, rounded(point.lat, point.lng));
              });
              markers.set(stop.id, pin);
            }
            const node = marker.getElement();
            node?.setAttribute(
              "aria-label",
              `第 ${index + 1} 站 ${stop.name}，可拖动微调位置`,
            );
            node?.setAttribute("role", "button");
            const tooltip = document.createElement("span");
            tooltip.textContent = stop.name;
            marker
              .unbindTooltip()
              .bindTooltip(tooltip, { direction: "top", offset: [0, -26] });
          });
          renderLines();
        };
        fit.current = () => {
          const coordinates = mapCoordinates(current.current.stops);
          if (coordinates.length) {
            instance.stop();
            instance.fitBounds(L.latLngBounds(coordinates), {
              padding: [55, 55],
              maxZoom: 14,
              animate: false,
            });
          }
        };
        redraw.current();
        fit.current();
        instance.on("click", (event) => {
          if (current.current.placing && !current.current.disabled)
            current.current.onAdd(rounded(event.latlng.lat, event.latlng.lng));
        });
        observer = new ResizeObserver(() =>
          instance.invalidateSize({ pan: false }),
        );
        observer.observe(element);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      markers.clear();
      redraw.current = () => {};
      fit.current = () => {};
    };
  }, []);
  return (
    <div className="route-map-shell" data-placing={props.placing}>
      <div
        ref={container}
        id={id}
        className="route-editor-map"
        role="region"
        aria-label="行程编辑地图，可拖动编号图钉"
        inert={locked}
      />
      <div className="route-map-tools">
        <button
          type="button"
          disabled={props.disabled || !props.stops.length}
          onClick={() => fit.current()}
        >
          ⊕ 查看全程
        </button>
        {touch && (
          <button
            type="button"
            disabled={props.disabled}
            aria-controls={id}
            aria-pressed={!locked}
            onClick={() => setInteracting((old) => !old)}
          >
            {locked ? "操作地图 ↗" : "锁定地图 ✓"}
          </button>
        )}
      </div>
      <p className="route-map-hint">
        {props.placing
          ? "点选地图，添加下一站"
          : locked
            ? "轻触「操作地图」后可拖动图钉、双指缩放"
            : "拖动编号图钉微调位置 · 点击站点查看详情"}
      </p>
      {failed && (
        <p className="route-map-error" role="status">
          部分地图未能加载，可使用搜索或手动坐标。
        </p>
      )}
    </div>
  );
}
