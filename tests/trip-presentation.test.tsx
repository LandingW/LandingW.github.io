import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  albumInput,
  type TravelAlbum,
  type TravelPhoto,
} from "../src/lib/travel";
import {
  googleMapsLink,
  normalizeMapsConfig,
  tripCoverPhotos,
  tripLocation,
} from "../src/lib/trip-presentation";
import TripCover from "../src/components/travel/TripCover";
import WorldMap from "../src/components/travel/WorldMap";

const album: TravelAlbum = {
  id: "trip",
  ...albumInput({ title: "测试旅行", latitude: 10, longitude: 20 }),
};
const photos: TravelPhoto[] = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i}`,
  albumId: "trip",
  width: 800,
  height: 600,
  caption: "",
  thumbnail: `photos/p${i}/v1/thumbnail.jpg`,
  preview: `photos/p${i}/v1/preview.jpg`,
  dzi: `photos/p${i}/v1/image.dzi`,
  location: { latitude: i, longitude: i },
}));

test("trip covers use four distinct images spread through the album, or the owner's ordered selection", () => {
  assert.deepEqual(
    tripCoverPhotos(album, photos).map((p) => p.id),
    ["p0", "p4", "p7", "p11"],
  );
  assert.deepEqual(
    tripCoverPhotos(
      { ...album, coverPhotoIds: ["p3", "p1", "outside"] },
      photos,
    ).map((p) => p.id),
    ["p3", "p1"],
  );
  for (let count = 1; count <= 4; count++) {
    const html = renderToStaticMarkup(
      createElement(TripCover, {
        album,
        photos: photos.slice(0, count),
        mediaBase: "https://media.example.com",
      }),
    );
    assert.equal((html.match(/<img /g) || []).length, count);
    assert.match(html, new RegExp(`data-count="${count}"`));
  }
  assert.throws(() => albumInput({ title: "test", coverPhotoIds: ["a", "a"] }));
  assert.throws(() =>
    albumInput({ title: "test", coverPhotoIds: ["a", "b", "c", "d", "e"] }),
  );
});

test("wide public covers opt into desktop previews without increasing editor or mobile image sizes", () => {
  const props = { album, photos, mediaBase: "https://media.example.com" };
  const compact = renderToStaticMarkup(createElement(TripCover, props));
  assert.doesNotMatch(compact, /<source/);
  const wide = renderToStaticMarkup(
    createElement(TripCover, { ...props, largePreview: true }),
  );
  assert.equal((wide.match(/<source /g) || []).length, 1);
  assert.match(wide, /media="\(min-width: 761px\)"/);
  assert.match(wide, /srcSet="https:\/\/media\.example\.com\/photos\/p0\/v1\/preview\.jpg"/);
  assert.equal((wide.match(/src="[^"]*thumbnail\.jpg"/g) || []).length, 4);
});

test("each trip has one marker, with the manually selected location taking priority over photo GPS", () => {
  assert.deepEqual(tripLocation(album, photos), {
    latitude: 10,
    longitude: 20,
  });
  assert.deepEqual(
    tripLocation({ ...album, latitude: null, longitude: null }, photos),
    { latitude: 0, longitude: 0 },
  );
  const html = renderToStaticMarkup(
    createElement(WorldMap, {
      albums: [album],
      photos,
      selected: "",
      onSelect: () => {},
    }),
  );
  assert.equal((html.match(/class="atlas-pin/g) || []).length, 1);
});

test("Google place selections retain only their ID and are not plotted on the non-Google fallback map", () => {
  const google = {
    id: "trip",
    ...albumInput({
      title: "Test",
      latitude: 40,
      longitude: 50,
      googlePlaceId: "ChIJ_test-place",
    }),
  };
  assert.equal(google.latitude, null);
  assert.equal(google.longitude, null);
  assert.equal(tripLocation(google, photos), null);
  const html = renderToStaticMarkup(
    createElement(WorldMap, {
      albums: [google],
      photos,
      selected: "",
      onSelect: () => {},
    }),
  );
  assert.equal(html.includes('class="atlas-pin'), false);
  const url = new URL(
    googleMapsLink("自己的地点名称", null, google.googlePlaceId),
  );
  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("query_place_id"), "ChIJ_test-place");
});

test("map settings accept browser keys only and reject unrelated service credentials", () => {
  assert.equal(normalizeMapsConfig({}).apiKey, "");
  assert.equal(
    normalizeMapsConfig({ apiKey: `AIza${"A".repeat(35)}` }).mapId,
    "DEMO_MAP_ID",
  );
  assert.throws(() => normalizeMapsConfig({ apiKey: "a".repeat(64) }));
  assert.throws(() =>
    normalizeMapsConfig({ apiKey: "github_pat_not_a_map_key" }),
  );
  assert.throws(() =>
    normalizeMapsConfig({
      apiKey: JSON.stringify({ private_key: "do-not-publish" }),
    }),
  );
});
