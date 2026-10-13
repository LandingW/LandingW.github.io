import { normalizeLocation, type PhotoLocation } from "./photo-metadata";

export const STOP_KINDS = {
  stay: "住宿",
  sight: "景点",
  food: "餐饮",
  transit: "交通",
  place: "地点",
} as const;
export type StopKind = keyof typeof STOP_KINDS;
export interface TripStop extends PhotoLocation {
  id: string;
  name: string;
  kind: StopKind;
  note: string;
}
export const MAX_TRIP_STOPS = 40;

// A search result has its own OSM id. Never let it replace the itinerary id:
// the same hotel can be visited more than once in one journey.
export function stopFromPoint(
  id: string,
  point: PhotoLocation,
  name: string,
  kind: StopKind = "place",
): TripStop {
  return {
    id,
    name,
    kind,
    note: "",
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

export function stopsInput(value: unknown): TripStop[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_TRIP_STOPS)
    throw new Error(`每次旅行最多添加 ${MAX_TRIP_STOPS} 个地点`);
  const ids = new Set<string>();
  return value.map((input) => {
    if (!input || typeof input !== "object") throw new Error("地点格式不正确");
    const v = input as Record<string, unknown>;
    const point = normalizeLocation(v);
    if (
      !point ||
      typeof v.id !== "string" ||
      !/^[\w-]{1,80}$/.test(v.id) ||
      ids.has(v.id)
    )
      throw new Error("每个地点需要有效坐标和不重复的编号");
    if (
      typeof v.name !== "string" ||
      !v.name.trim() ||
      v.name.trim().length > 120
    )
      throw new Error("地点名称需为 1–120 个字符");
    if (typeof v.kind !== "string" || !Object.hasOwn(STOP_KINDS, v.kind))
      throw new Error("地点类型不正确");
    if (
      v.note !== undefined &&
      (typeof v.note !== "string" || v.note.length > 400)
    )
      throw new Error("地点备注最多 400 个字符");
    ids.add(v.id);
    return {
      id: v.id,
      name: v.name.trim(),
      kind: v.kind as StopKind,
      note: ((v.note as string) || "").trim(),
      ...point,
    };
  });
}

export function stopsFromJson(value: unknown): TripStop[] {
  try {
    return stopsInput(typeof value === "string" ? JSON.parse(value) : value);
  } catch {
    return [];
  }
}

// Quadratic arcs in Web Mercator: an editorial connection, never a road route.
// Input longitudes are already unwrapped by mapCoordinates, including the date line.
export function routeArcs(points: [number, number][]): [number, number][][] {
  const radians = Math.PI / 180;
  const project = ([lat, lon]: [number, number]) => [
    lon * radians,
    Math.log(
      Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * radians) / 2),
    ),
  ];
  return points.slice(1).flatMap((to, index) => {
    const from = points[index];
    if ([...from, ...to].some((v) => !Number.isFinite(v))) return [];
    const [x0, y0] = project(from),
      [x1, y1] = project(to);
    const dx = x1 - x0,
      dy = y1 - y0;
    if (Math.hypot(dx, dy) < 1e-9) return [];
    const cx = (x0 + x1) / 2 - dy * 0.19;
    const cy = (y0 + y1) / 2 + dx * 0.19;
    const line: [number, number][] = Array.from({ length: 33 }, (_, i) => {
      if (i === 0) return from;
      if (i === 32) return to;
      const t = i / 32,
        u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      return [
        (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / radians,
        x / radians,
      ];
    });
    return [line];
  });
}

export interface PlaceResult extends PhotoLocation {
  id: string;
  name: string;
  address: string;
  kind: StopKind;
}
export function photonResults(input: unknown): PlaceResult[] {
  const features = (input as { features?: unknown[] })?.features;
  if (!Array.isArray(features)) throw new Error("地点搜索返回格式不正确");
  const ids = new Set<string>();
  return features.slice(0, 6).flatMap((feature) => {
    const f = feature as {
      geometry?: { type?: string; coordinates?: unknown[] };
      properties?: Record<string, unknown>;
    };
    const p = f?.properties;
    if (!p || f.geometry?.type !== "Point") return [];
    const point = normalizeLocation({
      latitude: f.geometry.coordinates?.[1],
      longitude: f.geometry.coordinates?.[0],
    });
    const name = typeof p.name === "string" ? p.name.slice(0, 120) : "";
    const osmType = String(p.osm_type),
      osmId = String(p.osm_id);
    if (!point || !name || !/^[NWR]$/.test(osmType) || !/^\d+$/.test(osmId))
      return [];
    const id = `${osmType}-${osmId}`;
    if (ids.has(id)) return [];
    ids.add(id);
    const tag = String(p.osm_value);
    const kind: StopKind = [
      "hotel",
      "guest_house",
      "hostel",
      "motel",
      "apartment",
      "camp_site",
    ].includes(tag)
      ? "stay"
      : ["restaurant", "cafe", "bar", "fast_food"].includes(tag)
        ? "food"
        : ["station", "aerodrome", "bus_station", "ferry_terminal"].includes(
              tag,
            )
          ? "transit"
          : p.osm_key === "tourism" || p.osm_key === "natural"
            ? "sight"
            : "place";
    const address = [
      ...new Set(
        [p.street, p.city, p.district, p.state, p.country].filter(
          (v): v is string => typeof v === "string",
        ),
      ),
    ]
      .join(" · ")
      .slice(0, 300);
    return [{ id, name, address, kind, ...point }];
  });
}
