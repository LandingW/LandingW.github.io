import type { Map as LeafletMap } from "leaflet";

export const TOUCH_MAP_QUERY = "(max-width: 760px), (pointer: coarse)";

/** Scroll stays with the page until a touch user explicitly enters the map. */
export function setMapInteraction(
  map: Pick<
    LeafletMap,
    "dragging" | "touchZoom" | "doubleClickZoom" | "boxZoom" | "keyboard"
  >,
  enabled: boolean,
) {
  for (const handler of [
    map.dragging,
    map.touchZoom,
    map.doubleClickZoom,
    map.boxZoom,
    map.keyboard,
  ]) {
    if (enabled) handler.enable();
    else handler.disable();
  }
}
