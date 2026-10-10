"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadGoogleMaps, resolveGooglePlace } from "@/lib/google-maps";
import type { PhotoLocation } from "@/lib/photo-metadata";

export interface GoogleMapPin {
  id: string;
  label: string;
  location?: PhotoLocation | null;
  googlePlaceId?: string | null;
}
export interface GoogleMapPick {
  location: PhotoLocation;
  googlePlaceId: string | null;
}

export default function GoogleMapView({
  apiKey,
  mapId,
  pins,
  selected = "",
  onSelect,
  onPick,
}: {
  apiKey: string;
  mapId?: string;
  pins: GoogleMapPin[];
  selected?: string;
  onSelect?: (id: string) => void;
  onPick?: (value: GoogleMapPick) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    searchHost = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const controls = useRef({ onSelect, onPick, selected });
  const markers = useRef<
    {
      id: string;
      marker: google.maps.marker.AdvancedMarkerElement;
      node: HTMLElement;
      position: PhotoLocation;
    }[]
  >([]);
  const [version, setVersion] = useState(0),
    [error, setError] = useState("");
  const picking = Boolean(onPick),
    markerKey = JSON.stringify(pins);
  useEffect(() => {
    controls.current = { onSelect, onPick, selected };
  }, [onSelect, onPick, selected]);
  useEffect(() => {
    let disposed = false,
      selection = 0;
    let autocomplete: google.maps.places.PlaceAutocompleteElement | undefined;
    let listener: google.maps.MapsEventListener | undefined;
    const container = host.current,
      search = searchHost.current;
    void loadGoogleMaps(apiKey)
      .then(() => {
        if (disposed || !container) return;
        const instance = new google.maps.Map(container, {
          center: { lat: 22, lng: 15 },
          zoom: 2,
          mapId: mapId || "DEMO_MAP_ID",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
        });
        map.current = instance;
        const choosePlace = async (
          placeId: string,
          place?: google.maps.places.Place,
        ) => {
          const request = ++selection;
          try {
            const location = await resolveGooglePlace(placeId, place);
            if (disposed || request !== selection) return;
            instance.setCenter({
              lat: location.latitude,
              lng: location.longitude,
            });
            instance.setZoom(15);
            controls.current.onPick?.({ location, googlePlaceId: placeId });
            setError("");
          } catch {
            if (!disposed)
              setError("无法读取这个地点，请检查 Places API 权限或重新选择。");
          }
        };
        if (picking && search) {
          autocomplete = new google.maps.places.PlaceAutocompleteElement();
          autocomplete.setAttribute("placeholder", "搜索城市、景点或具体地址");
          autocomplete.setAttribute("aria-label", "搜索 Google 地点");
          autocomplete.addEventListener("gmp-select", (event) => {
            const prediction = (
              event as google.maps.places.PlacePredictionSelectEvent
            ).placePrediction;
            const place = prediction.toPlace();
            void choosePlace(place.id, place);
          });
          autocomplete.addEventListener("gmp-error", () => {
            if (!disposed)
              setError("Google 地点搜索不可用，请检查 API、域名限制及配额。");
          });
          search.append(autocomplete);
          listener = instance.addListener(
            "click",
            (event: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
              if ("placeId" in event && event.placeId) {
                event.stop();
                void choosePlace(event.placeId);
              } else if (event.latLng) {
                selection++;
                controls.current.onPick?.({
                  location: {
                    latitude: event.latLng.lat(),
                    longitude: event.latLng.lng(),
                  },
                  googlePlaceId: null,
                });
              }
            },
          );
        }
        setVersion((value) => value + 1);
      })
      .catch((reason) => {
        if (!disposed)
          setError(
            reason instanceof Error && reason.message.includes("刷新")
              ? reason.message
              : "Google 地图暂时无法加载，请检查 API key、网络和 Google Cloud 配置。",
          );
      });
    return () => {
      disposed = true;
      listener?.remove();
      autocomplete?.remove();
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
      container?.replaceChildren();
    };
  }, [apiKey, mapId, picking]);
  useEffect(() => {
    if (!version || !map.current) return;
    let disposed = false;
    const currentMap = map.current;
    const entries = JSON.parse(markerKey) as GoogleMapPin[];
    void Promise.all(
      entries.map(async (pin) => {
        try {
          return {
            pin,
            location: pin.googlePlaceId
              ? await resolveGooglePlace(pin.googlePlaceId)
              : pin.location,
          };
        } catch {
          if (!disposed)
            setError("部分 Google 地点暂时无法解析，旅行列表仍可使用。");
          return { pin, location: null };
        }
      }),
    ).then((resolved) => {
      if (disposed) return;
      const bounds = new google.maps.LatLngBounds();
      const created = resolved.flatMap(({ pin, location }, index) => {
        if (!location) return [];
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: currentMap,
          position: { lat: location.latitude, lng: location.longitude },
          title: pin.label,
          gmpClickable: true,
          gmpDraggable: picking,
        });
        const node = document.createElement("span");
        node.className = "google-trip-pin";
        node.textContent = picking ? "●" : String(index + 1).padStart(2, "0");
        marker.append(node);
        marker.addEventListener("gmp-click", () =>
          controls.current.onSelect?.(pin.id),
        );
        if (picking)
          marker.addListener("dragend", () => {
            const position = marker.position;
            if (!position) return;
            const lat =
              typeof position.lat === "function"
                ? position.lat()
                : position.lat;
            const lng =
              typeof position.lng === "function"
                ? position.lng()
                : position.lng;
            controls.current.onPick?.({
              location: { latitude: lat, longitude: lng },
              googlePlaceId: null,
            });
          });
        bounds.extend({ lat: location.latitude, lng: location.longitude });
        return [{ id: pin.id, marker, node, position: location }];
      });
      markers.current = created;
      const active = created.find(
        (item) => item.id === controls.current.selected,
      );
      if (active) {
        currentMap.setCenter({
          lat: active.position.latitude,
          lng: active.position.longitude,
        });
        currentMap.setZoom(picking ? 15 : 10);
      } else if (created.length === 1) {
        currentMap.setCenter({
          lat: created[0].position.latitude,
          lng: created[0].position.longitude,
        });
        currentMap.setZoom(picking ? 15 : 8);
      } else if (created.length) currentMap.fitBounds(bounds, 50);
      for (const item of created) {
        item.node.classList.toggle(
          "is-active",
          item.id === controls.current.selected,
        );
        item.marker.zIndex =
          item.id === controls.current.selected ? 1000 : undefined;
      }
    });
    return () => {
      disposed = true;
      for (const item of markers.current) {
        google.maps.event.clearInstanceListeners(item.marker);
        item.marker.map = null;
        item.marker.remove();
      }
      markers.current = [];
    };
  }, [version, markerKey, picking]);
  useEffect(() => {
    for (const item of markers.current) {
      item.node.classList.toggle("is-active", item.id === selected);
      item.marker.zIndex = item.id === selected ? 1000 : undefined;
    }
    const pin = markers.current.find((item) => item.id === selected);
    if (pin && map.current)
      map.current.panTo({
        lat: pin.position.latitude,
        lng: pin.position.longitude,
      });
  }, [selected]);
  return (
    <div className="google-map-view">
      {picking && <div ref={searchHost} className="google-place-search" />}
      <div
        ref={host}
        className="google-map-canvas"
        aria-label={picking ? "Google 地图选点" : "Google 旅行地图"}
      />
      {!version && !error && (
        <p className="map-service-note" role="status">
          正在加载 Google 地图…
        </p>
      )}
      {error && (
        <p className="map-service-note" role="status">
          {error}
        </p>
      )}
      {picking && (
        <p className="map-service-note">
          搜索地点，或直接点击/拖动地图标记。
          <Link href="/travel/privacy/">地图服务说明</Link>
        </p>
      )}
    </div>
  );
}
