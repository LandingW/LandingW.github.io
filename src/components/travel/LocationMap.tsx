"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";

export default function LocationMap({
  latitude,
  longitude,
  place,
  onPick,
}: {
  latitude: number;
  longitude: number;
  place: string;
  onPick?: (latitude: number, longitude: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const locationRef = useRef({ latitude, longitude });
  const previousLocation = useRef({ latitude, longitude });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    locationRef.current = { latitude, longitude };
    const previous = previousLocation.current;
    if (
      mapRef.current &&
      (previous.latitude !== latitude || previous.longitude !== longitude)
    ) {
      const point: [number, number] = [
        Math.max(-85, Math.min(85, latitude)),
        longitude,
      ];
      markerRef.current?.setLatLng(point);
      mapRef.current.setView(point, 11, {
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
    }
    previousLocation.current = { latitude, longitude };
  }, [latitude, longitude]);
  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed) return;
        const current = locationRef.current;
        const point: [number, number] = [
          Math.max(-85, Math.min(85, current.latitude)),
          current.longitude,
        ];
        const map = L.map(container, {
          scrollWheelZoom: false,
          attributionControl: true,
        }).setView(
          point,
          onPick && current.latitude === 0 && current.longitude === 0 ? 2 : 11,
        );
        mapRef.current = map;
        const marker = L.circleMarker(point, {
          color: "#df4b30",
          fillColor: "#df4b30",
          fillOpacity: 1,
          radius: 6,
          weight: 2,
        }).addTo(map);
        markerRef.current = marker;
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          },
        ).addTo(map);
        tiles.on("tileerror", () => setFailed(true));
        if (pickRef.current)
          map.on("click", (event) => {
            const lat = Math.max(-85, Math.min(85, event.latlng.lat));
            const lon = ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180;
            marker.setLatLng([lat, lon]);
            previousLocation.current = { latitude: lat, longitude: lon };
            pickRef.current?.(lat, lon);
          });
        cleanup = () => {
          map.remove();
          mapRef.current = null;
          markerRef.current = null;
        };
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      cleanup?.();
    };
    // The picker owns its camera while a user is dragging it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="travel-location">
      <div
        ref={ref}
        className="location-map"
        aria-label={onPick ? "点击地图选择公开地点" : `${place}位置地图`}
      />
      {failed && <p role="status">部分地图暂时无法加载。地点文字仍可使用。</p>}
      {Math.abs(latitude) > 85 && (
        <p>该位置位于极区，街道地图按可显示纬度定位；原始坐标仍保留。</p>
      )}
      <a
        href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=12/${latitude}/${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        在 OpenStreetMap 中打开 ↗
      </a>
    </div>
  );
}
