import {
  geoAzimuthalEqualArea,
  geoCentroid,
  geoContains,
  geoPath,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryObject } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import countries from "world-atlas/countries-50m.json";
import { normalizeLocation, type PhotoLocation } from "./photo-metadata";

const collection = feature(
  countries as unknown as Topology,
  countries.objects.countries as GeometryObject,
);
const features = (
  collection.type === "FeatureCollection" ? collection.features : [collection]
) as Feature<Geometry | null, { name?: string }>[];
// Display aliases only; geography is the bundled Natural Earth dataset.
const aliases: Record<string, [string, string]> = {
  "578": ["挪威", "NO"],
  "752": ["瑞典", "SE"],
  "246": ["芬兰", "FI"],
  "352": ["冰岛", "IS"],
  "208": ["丹麦", "DK"],
  "156": ["中国", "CN"],
  "392": ["日本", "JP"],
  "410": ["韩国", "KR"],
  "764": ["泰国", "TH"],
  "704": ["越南", "VN"],
  "702": ["新加坡", "SG"],
  "458": ["马来西亚", "MY"],
  "360": ["印度尼西亚", "ID"],
  "840": ["美国", "US"],
  "124": ["加拿大", "CA"],
  "484": ["墨西哥", "MX"],
  "826": ["英国", "GB"],
  "250": ["法国", "FR"],
  "276": ["德国", "DE"],
  "380": ["意大利", "IT"],
  "724": ["西班牙", "ES"],
  "620": ["葡萄牙", "PT"],
  "756": ["瑞士", "CH"],
  "040": ["奥地利", "AT"],
  "528": ["荷兰", "NL"],
  "300": ["希腊", "GR"],
  "792": ["土耳其", "TR"],
  "036": ["澳大利亚", "AU"],
  "554": ["新西兰", "NZ"],
  "076": ["巴西", "BR"],
  "032": ["阿根廷", "AR"],
  "152": ["智利", "CL"],
  "710": ["南非", "ZA"],
};

export interface CountryShape {
  id: string;
  name: string;
  localName: string;
  code: string;
  geometry: Feature<Geometry | null>;
  source: "coordinates" | "place";
}

export function countryAt(
  location: PhotoLocation | null,
  place = "",
): CountryShape | null {
  location = normalizeLocation(location);
  const located =
    location &&
    features.find((item) =>
      geoContains(item, [location.longitude, location.latitude]),
    );
  // Small coastal islands may be absent at this scale. Only an explicit country
  // name in the owner's destination may fill this gap; never choose the nearest.
  const tokens = place
    .split(/[·,/，|]/)
    .map((part) => part.trim().toLowerCase());
  const named = features.find((item) =>
    tokens.some(
      (token) =>
        token &&
        (token === String(item.properties?.name).toLowerCase() ||
          token === aliases[String(item.id)]?.[0]),
    ),
  );
  const found = located || named;
  if (!found) return null;
  const id = String(found.id),
    name = String(found.properties?.name || "");
  return {
    id,
    name,
    localName: aliases[id]?.[0] || name,
    code: aliases[id]?.[1] || "",
    geometry: found,
    source: located ? "coordinates" : "place",
  };
}

export function countryDrawing(
  country: CountryShape,
  location: PhotoLocation | null,
) {
  const center = geoCentroid(country.geometry);
  const projection = geoAzimuthalEqualArea()
    .rotate([-center[0], -center[1]])
    .fitExtent(
      [
        [36, 22],
        [324, 270],
      ],
      country.geometry,
    );
  const pin = location
    ? projection([location.longitude, location.latitude])
    : null;
  return {
    path: geoPath(projection)(country.geometry) || "",
    pin:
      pin &&
      pin.every(Number.isFinite) &&
      pin[0] >= 8 &&
      pin[0] <= 352 &&
      pin[1] >= 8 &&
      pin[1] <= 284
        ? pin
        : null,
  };
}
