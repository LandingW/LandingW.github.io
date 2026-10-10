"use client";

import { useEffect, useRef, useState } from "react";

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
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed) return;
        const map = L.map(container, {
          scrollWheelZoom: false,
          attributionControl: true,
        }).setView([latitude, longitude], onPick ? 5 : 11);
        const marker = L.circleMarker([latitude, longitude], {
          color: "#df4b30",
          fillColor: "#df4b30",
          fillOpacity: 1,
          radius: 6,
          weight: 2,
        }).addTo(map);
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
            pickRef.current?.(lat, lon);
          });
        cleanup = () => map.remove();
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
