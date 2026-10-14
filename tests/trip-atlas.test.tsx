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
  tripPoints,
  mapCoordinates,
  coordinateLabel,
  osmPointLink,
  pointSource,
} from "../src/lib/trip-atlas";
import { countryAt, countryDrawing } from "../src/lib/country-geography";
import CountryOutline from "../src/components/travel/CountryOutline";
import TripEquipment from "../src/components/travel/TripEquipment";
import TripChapterNav from "../src/components/travel/TripChapterNav";
import TripStory from "../src/components/travel/TripStory";
import TripAtlas from "../src/components/travel/TripAtlas";
import { setMapInteraction, TOUCH_MAP_QUERY } from "../src/lib/map-interaction";

const album: TravelAlbum = {
  id: "norway",
  ...albumInput({
    title: "北方手记",
    place: "挪威 · Sommarøy Arctic Hotel 附近",
    latitude: 69.6355911,
    longitude: 17.9914452,
  }),
};
function photo(id: string, latitude?: number, longitude?: number): TravelPhoto {
  return {
    id,
    albumId: album.id,
    caption: "",
    width: 900,
    height: 600,
    thumbnail: `photos/${id}/v1/thumbnail.jpg`,
    preview: `photos/${id}/v1/preview.jpg`,
    dzi: `photos/${id}/v1/image.dzi`,
    location:
      latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : null,
  };
}

test("photos without GPS never inherit the trip pin as their capture location", () => {
  const photos = [photo("one"), photo("two")];
  const snapshot = JSON.stringify({ album, photos });
  const points = tripPoints(album, photos);
  assert.equal(points.length, 1);
  assert.equal(points[0].source, "trip");
  assert.equal(points[0].photos.length, 0);
  assert.equal(JSON.stringify({ album, photos }), snapshot);
});

test("co-located GPS images share a marker without losing photographs or source labels", () => {
  const photos = [
    photo("one", 10, 20),
    photo("two", 10, 20),
    photo("three", album.latitude!, album.longitude!),
  ];
  const points = tripPoints(album, photos);
  assert.equal(points.length, 2);
  assert.equal(points[1].photos.length, 2);
  assert.equal(points[0].source, "mixed");
  assert.equal(pointSource(points[0]), "旅行定位 · 照片 GPS");
  assert.equal(points[1].source, "photo");
});

test("empty, invalid, and other-album locations cannot introduce fake points", () => {
  const empty = { ...album, latitude: null, longitude: null };
  assert.deepEqual(
    tripPoints(empty, [
      photo("one"),
      { ...photo("two", 20, 30), albumId: "other" },
      photo("bad", 100, 999),
    ]),
    [],
  );
  assert.deepEqual(
    tripPoints({ ...album, googlePlaceId: "ChIJ_example" }, []),
    [],
  );
});

test("zero coordinates and southern/western hemispheres remain correct", () => {
  const zero = tripPoints({ ...album, latitude: 0, longitude: 0 }, []);
  assert.equal(zero.length, 1);
  assert.equal(coordinateLabel(zero[0]), "0.0000° N / 0.0000° E");
  assert.equal(
    coordinateLabel({ latitude: -33.12345, longitude: -70.5 }, 3),
    "33.123° S / 70.500° W",
  );
  assert.equal(new URL(osmPointLink(zero[0])).searchParams.get("mlat"), "0");
});

test("date-line points fit nearby rather than spanning the world, polar coordinates remain intact", () => {
  const points = [
    { latitude: 10, longitude: 179 },
    { latitude: 15, longitude: -179 },
  ];
  const result = mapCoordinates(points);
  assert.equal(Math.abs(result[0][1] - result[1][1]), 2);
  assert.deepEqual(mapCoordinates([]), []);
  const polar = { latitude: 89, longitude: 15 };
  assert.deepEqual(mapCoordinates([polar]), [[85, 15]]);
  assert.equal(polar.latitude, 89);
});

test("countries use real geometry and an explicit place-name fallback for small islands", () => {
  const country = countryAt(
    { latitude: album.latitude!, longitude: album.longitude! },
    album.place,
  );
  assert.equal(country?.id, "578");
  assert.equal(country?.localName, "挪威");
  const drawing = countryDrawing(country!, {
    latitude: album.latitude!,
    longitude: album.longitude!,
  });
  assert.ok(drawing.path.startsWith("M"));
  assert.ok(drawing.path.length > 100);
  assert.ok(drawing.pin?.every(Number.isFinite));
  assert.doesNotMatch(drawing.path, /NaN|Infinity/);
  assert.equal(
    countryAt({ latitude: 48.85, longitude: 2.35 })?.localName,
    "法国",
  );
  assert.equal(countryAt(null, "挪威 · 岛屿")?.source, "place");
});

test("unknown destinations and open ocean never receive an invented country", () => {
  assert.equal(countryAt(null, "fe"), null);
  assert.equal(countryAt({ latitude: 0, longitude: -140 }), null);
  assert.equal(countryAt(null, "我觉得这里像挪威"), null);
  const html = renderToStaticMarkup(
    createElement(CountryOutline, { location: null, place: "" }),
  );
  assert.match(html, /添加位置后可以显示对应的国家轮廓/);
  assert.doesNotMatch(html, /country-land/);
});

test("country contour is labelled, attributed and backed by coordinates", () => {
  const html = renderToStaticMarkup(
    createElement(CountryOutline, {
      location: { latitude: album.latitude!, longitude: album.longitude! },
      place: album.place,
    }),
  );
  assert.match(html, /挪威轮廓及当前点位/);
  assert.match(html, /Natural Earth/);
  assert.match(html, /69.6356° N/);
  assert.match(html, /country-land/);
});

test("equipment summary uses actual metadata and does not guess model from lens specifications", () => {
  const photos = [
    {
      ...photo("one"),
      camera: {
        focalLength: 22,
        fNumber: 2.8,
        exposureTime: 8,
        iso: 640,
        lensSpec: { minFocal: 16, maxFocal: 35, minAperture: 2.8 },
      },
    },
    { ...photo("two"), camera: { focalLength: 35, iso: 800 } },
  ];
  const html = renderToStaticMarkup(createElement(TripEquipment, { photos }));
  assert.match(html, /机身型号未记录/);
  assert.match(html, /镜头型号未记录/);
  assert.match(html, /16–35 mm f\/2.8/);
  assert.match(html, /22 mm — 35 mm/);
  assert.match(html, /ISO 640 — ISO 800/);
  assert.match(html, /8 s/);
  assert.doesNotMatch(html, /Sony|Canon|Nikon/);
});

test("chapter navigation uses real anchors and an accessible active state", () => {
  const html = renderToStaticMarkup(createElement(TripChapterNav));
  for (const id of ["story-places", "story-frames", "story-equipment"])
    assert.ok(html.includes(`href="#${id}"`));
  assert.match(html, /aria-label="旅行章节"/);
  assert.match(html, /aria-current="location"/);
});

test("travel detail retains title, cover, photos, and adds distinct place and equipment chapters", () => {
  const html = renderToStaticMarkup(
    createElement(TripStory, {
      album,
      photos: [photo("one"), photo("two")],
      config: { apiUrl: "", mediaUrl: "https://media.example.com" },
      onOpen: () => {},
      onBack: () => {},
    }),
  );
  assert.match(html, /北方手记/);
  assert.match(html, /放大查看旅行封面/);
  assert.match(html, /id="story-places"/);
  assert.match(html, /id="story-equipment"/);
  assert.match(html, /1 个地点 · 0 张照片带 GPS/);
  assert.match(html, /照片未记录 GPS，无法确定各张的拍摄地点/);
  assert.match(html, /https:\/\/www.openstreetmap.org/);
  assert.doesNotMatch(html, /Google|路线距离|旅行天数/);
});

test("touch map guard disables every gesture handler and can restore desktop interaction", () => {
  const calls: string[] = [];
  const handlers = [
    "dragging",
    "touchZoom",
    "doubleClickZoom",
    "boxZoom",
    "keyboard",
  ];
  const map = Object.fromEntries(
    handlers.map((name) => [
      name,
      {
        enable: () => calls.push(`${name}:on`),
        disable: () => calls.push(`${name}:off`),
      },
    ]),
  ) as unknown as Parameters<typeof setMapInteraction>[0];
  setMapInteraction(map, false);
  assert.deepEqual(
    calls.splice(0),
    handlers.map((name) => `${name}:off`),
  );
  setMapInteraction(map, true);
  assert.deepEqual(
    calls,
    handlers.map((name) => `${name}:on`),
  );
  assert.match(TOUCH_MAP_QUERY, /max-width: 760px/);
  assert.match(TOUCH_MAP_QUERY, /pointer: coarse/);
});

test("mobile point picker preserves every location and exposes its label and current value", () => {
  const html = renderToStaticMarkup(
    createElement(TripAtlas, {
      album,
      photos: [photo("one", 10, 20), photo("two", 11, 21)],
      config: { apiUrl: "", mediaUrl: "https://media.example.com" },
      onOpen: () => {},
    }),
  );
  const label = html.match(/<label for="([^"]+)">切换点位<\/label>/);
  assert.ok(label);
  assert.ok(html.includes(`<select id="${label[1]}"`));
  assert.equal((html.match(/<option /g) || []).length, 3);
  assert.match(html, /<option[^>]*selected=""/);
  assert.match(html, /照片 GPS/);
});

test("single and unlocated trips do not repeat a redundant location selector", () => {
  const props = {
    photos: [photo("one")],
    config: { apiUrl: "", mediaUrl: "https://media.example.com" },
    onOpen: () => {},
  };
  const single = renderToStaticMarkup(
    createElement(TripAtlas, { ...props, album }),
  );
  assert.doesNotMatch(single, /<select|journey-point-list/);
  assert.match(single, /旅行定位/);
  const empty = renderToStaticMarkup(
    createElement(TripAtlas, {
      ...props,
      album: { ...album, latitude: null, longitude: null },
    }),
  );
  assert.match(empty, /data-has-points="false"/);
  assert.doesNotMatch(empty, /journey-point-panel|<select/);
  assert.match(empty, /补充旅行地点/);
});
