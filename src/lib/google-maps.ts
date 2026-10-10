"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { PhotoLocation } from "./photo-metadata";

let configuredKey = "";
let loading: Promise<void> | undefined;
const places = new Map<
  string,
  { expires: number; value: Promise<PhotoLocation> }
>();

export async function loadGoogleMaps(apiKey: string) {
  if (!apiKey) throw new Error("尚未配置 Google Maps API key");
  if (configuredKey && configuredKey !== apiKey)
    throw new Error("地图配置已更改，请刷新页面");
  if (!loading) {
    configuredKey = apiKey;
    setOptions({ key: apiKey, v: "weekly", language: "zh-CN" });
    loading = Promise.all([
      importLibrary("maps"),
      importLibrary("marker"),
      importLibrary("places"),
    ]).then(() => undefined);
  }
  await loading;
}

export function resolveGooglePlace(
  id: string,
  predictedPlace?: google.maps.places.Place,
): Promise<PhotoLocation> {
  const cached = places.get(id);
  // A fresh autocomplete selection must complete its own Places session.
  if (!predictedPlace && cached && cached.expires > Date.now())
    return cached.value;
  const value = (async () => {
    const place = predictedPlace || new google.maps.places.Place({ id });
    await place.fetchFields({ fields: ["id", "location"] });
    if (!place.location) throw new Error("该地点暂时没有可用坐标");
    return { latitude: place.location.lat(), longitude: place.location.lng() };
  })();
  // Transient display state only; no Places details in localStorage, D1 or R2.
  places.set(id, { expires: Date.now() + 5 * 60 * 1000, value });
  void value.catch(() => places.delete(id));
  return value;
}
