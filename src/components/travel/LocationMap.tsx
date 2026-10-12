"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { normalizeLocation } from "@/lib/photo-metadata";

export default function LocationMap({
  latitude,
  longitude,
  place,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  place: string;
  onPick?: (latitude: number, longitude: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const updateMarker = useRef<
    ((latitude: number | null, longitude: number | null) => void) | null
  >(null);
  const pick = useRef(onPick);
  const latest = useRef({ latitude, longitude });
  const picked = useRef(false);
  const [failed, setFailed] = useState(false);
  const location = normalizeLocation({ latitude, longitude });
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  useEffect(() => {
    latest.current = { latitude, longitude };
    updateMarker.current?.(latitude, longitude);
    if (
      map.current &&
      latitude !== null &&
      longitude !== null &&
      !picked.current
    )
      map.current.setView(
        [Math.max(-85, Math.min(85, latitude)), longitude],
        11,
        { animate: false },
      );
    picked.current = false;
  }, [latitude, longitude]);
  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    let disposed = false;
    let resize: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed) return;
        const initial = normalizeLocation(latest.current);
        const instance = L.map(element, {
          scrollWheelZoom: false,
          attributionControl: true,
        }).setView(
          initial
            ? [Math.max(-85, Math.min(85, initial.latitude)), initial.longitude]
            : [20, 0],
          initial ? 11 : 2,
        );
        map.current = instance;
        const icon = L.divIcon({
          className: "osm-trip-pin",
          html: '<svg viewBox="0 0 32 42" aria-hidden="true"><path d="M16 40C13 35 2 23 2 16a14 14 0 1 1 28 0c0 7-11 19-14 24Z"/><circle cx="16" cy="16" r="5"/></svg>',
          iconSize: [28, 37],
          iconAnchor: [14, 37],
        });
        updateMarker.current = (lat, lon) => {
          const point = normalizeLocation({ latitude: lat, longitude: lon });
          if (!point) {
            marker.current?.remove();
            marker.current = null;
            return;
          }
          const coords: [number, number] = [
            Math.max(-85, Math.min(85, point.latitude)),
            point.longitude,
          ];
          if (marker.current) marker.current.setLatLng(coords);
          else
            marker.current = L.marker(coords, {
              icon,
              title: "旅行地点",
              keyboard: false,
            }).addTo(instance);
        };
        updateMarker.current(latest.current.latitude, latest.current.longitude);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        })
          .addTo(instance)
          .on("tileerror", () => setFailed(true));
        instance.on("click", (event) => {
          if (!pick.current) return;
          const lat = Math.max(-85, Math.min(85, event.latlng.lat));
          const lon = ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180;
          updateMarker.current?.(lat, lon);
          picked.current = true;
          pick.current(lat, lon);
        });
        resize = new ResizeObserver(() => {
          if (element.clientWidth && element.clientHeight)
            instance.invalidateSize({ pan: false });
        });
        resize.observe(element);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
      marker.current = null;
      updateMarker.current = null;
    };
  }, []);
  return (
    <div className="travel-location">
      {onPick && (
        <p className="map-picker-instructions">
          放大到目的地后点击地图放置图钉，再保存旅行。
          {!location && "当前尚未选择地点。"}
        </p>
      )}
      <div
        ref={container}
        className="location-map"
        aria-label={onPick ? "点击地图选择旅行地点" : `${place}位置地图`}
      />
      {failed && (
        <p role="status">
          地图瓦片暂时无法加载，可以稍后重试或手动填写经纬度。
        </p>
      )}
      {location && Math.abs(location.latitude) > 85 && (
        <p>极区地图按可显示纬度定位；原始坐标保留。</p>
      )}
      <a
        href={
          location
            ? `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=12/${location.latitude}/${location.longitude}`
            : `https://www.openstreetmap.org/search?query=${encodeURIComponent(place)}`
        }
        target="_blank"
        rel="noopener noreferrer"
      >
        {location ? "在 OpenStreetMap 中打开 ↗" : "在 OpenStreetMap 查找地点 ↗"}
      </a>
    </div>
  );
}
