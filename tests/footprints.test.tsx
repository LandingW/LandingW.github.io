import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs/promises";
import {
  albumInput,
  type TravelAlbum,
  type TravelPhoto,
} from "../src/lib/travel";
import { worldFootprints } from "../src/lib/world-footprints";
import WorldMap from "../src/components/travel/WorldMap";
import TravelPreview from "../src/components/travel/TravelPreview";

const album = (
  id: string,
  latitude: number | null,
  longitude: number | null,
): TravelAlbum => ({
  id,
  ...albumInput({ title: `Trip ${id}`, latitude, longitude }),
});
test("footprints retain zero coordinates, omit unknown points, and group nearby trips without changing data", () => {
  const input = [
    album("zero", 0, 0),
    album("near", 0.001, 0),
    album("far", 60, -100),
    album("unknown", null, null),
  ];
  const before = JSON.stringify(input);
  const pins = worldFootprints(input, []);
  assert.equal(pins.length, 2);
  assert.deepEqual(
    pins[0].albums.map((a) => a.id),
    ["zero", "near"],
  );
  assert.deepEqual(
    pins[1].albums.map((a) => a.id),
    ["far"],
  );
  assert.equal(JSON.stringify(input), before);
  assert.equal(worldFootprints([{ ...input[0], latitude: NaN }], []).length, 0);
});
test("pins use photo GPS only when no trip coordinate exists and never invent locations from a place name", () => {
  const trip = { ...album("photo", null, null), place: "A place name alone" };
  const photo = {
    id: "a",
    albumId: "photo",
    location: { latitude: 65, longitude: 15 },
  } as TravelPhoto;
  assert.equal(worldFootprints([trip], []).length, 0);
  assert.equal(worldFootprints([trip], [photo]).length, 1);
  assert.notEqual(
    worldFootprints([{ ...trip, latitude: 0, longitude: 0 }], [photo])[0].x,
    worldFootprints([trip], [photo])[0].x,
  );
});
test("map pins are semantic links to the correct trip and safe titles remain escaped", () => {
  const html = renderToStaticMarkup(
    createElement(WorldMap, {
      albums: [{ ...album("a", 10, 10), title: "<script>bad</script>" }],
      selected: "",
      onSelect: () => {},
    }),
  );
  assert.match(html, /href="\/travel\/\?trip=a"/);
  assert.match(html, /data-pin="a"/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
test("homepage fourth section always has a usable link without waiting for network", () => {
  const html = renderToStaticMarkup(createElement(TravelPreview));
  assert.match(html, /id="travel"/);
  assert.match(html, /href="\/travel\/?"/);
  assert.match(html, /04/);
});
test("frontend uses no Google map SDK, key configuration, or geocoding requests", async () => {
  const files = [
    "src/lib/travel-client.ts",
    "src/components/travel/WorldMap.tsx",
    "src/components/travel/LocationMap.tsx",
    "src/components/travel/TravelManager.tsx",
  ];
  const code = (
    await Promise.all(files.map((file) => fs.readFile(file, "utf8")))
  ).join("\n");
  assert.doesNotMatch(
    code,
    /maps\.googleapis|googleMapsApiKey|GoogleMapView|\/admin\/maps|nominatim/,
  );
  assert.match(code, /https:\/\/tile\.openstreetmap\.org/);
  assert.match(code, /OpenStreetMap/);
});
