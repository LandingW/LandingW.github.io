import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readExifBlock } from "../scripts/photo-exif";
import { generatePhoto } from "../scripts/photo-processing";
import {
  cameraFacts,
  captureDate,
  normalizeCamera,
  normalizeLocation,
  exposureLabel,
} from "../src/lib/photo-metadata";
import PhotoFacts from "../src/components/travel/PhotoFacts";
import WorldMap from "../src/components/travel/WorldMap";

function fixture() {
  return sharp({
    create: { width: 64, height: 48, channels: 3, background: "#996655" },
  }).withExif({
    IFD0: { Make: "Example Camera", Model: "Model Test" },
    IFD2: {
      LensModel: "Test Lens 35mm",
      FNumber: "28/10",
      ExposureTime: "1/125",
      ISOSpeedRatings: "200",
      FocalLength: "35/1",
      FocalLengthIn35mmFilm: "53",
      DateTimeOriginal: "2026:10:10 15:20:30",
      OffsetTimeOriginal: "+08:00",
      BodySerialNumber: "PRIVATE_BODY_SERIAL",
      LensSerialNumber: "PRIVATE_LENS_SERIAL",
      UserComment: "PRIVATE_COMMENT",
    },
    IFD3: {
      GPSLatitudeRef: "S",
      GPSLatitude: "31/1 12/1 0/1",
      GPSLongitudeRef: "W",
      GPSLongitude: "121/1 30/1 0/1",
    },
  });
}

test("EXIF is read consistently from JPEG, PNG and WebP without publishing unrelated fields", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const buffer = await fixture().toFormat(format).toBuffer();
    const result = await readExifBlock((await sharp(buffer).metadata()).exif);
    assert.equal(result.camera?.make, "Example Camera");
    assert.equal(result.camera?.model, "Model Test");
    assert.equal(result.camera?.lens, "Test Lens 35mm");
    assert.equal(result.camera?.fNumber, 2.8);
    assert.equal(result.camera?.exposureTime, 1 / 125);
    assert.equal(result.camera?.iso, 200);
    assert.equal(result.camera?.capturedAt, "2026-10-10T15:20:30");
    assert.equal(result.camera?.utcOffset, "+08:00");
    assert.deepEqual(result.gps, { latitude: -31.2, longitude: -121.5 });
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|Serial|Comment|Maker/);
  }
});

test("missing or broken EXIF stays unknown; zero coordinates remain a valid recorded location", async () => {
  assert.deepEqual(await readExifBlock(undefined), { camera: null, gps: null });
  assert.deepEqual(await readExifBlock(Buffer.from("broken EXIF")), {
    camera: null,
    gps: null,
  });
  assert.equal(normalizeLocation({ latitude: 31 }), null);
  assert.equal(normalizeLocation({ latitude: 91, longitude: 2 }), null);
  assert.deepEqual(normalizeLocation({ latitude: 0, longitude: 0 }), {
    latitude: 0,
    longitude: 0,
  });
  assert.equal(captureDate("2026:02:30 12:00:00"), undefined);
  assert.equal(captureDate("2026:10:10 12:00:00"), "2026-10-10T12:00:00");
  assert.equal(
    normalizeCamera({ fNumber: -1, iso: Infinity, bodySerial: "secret" }),
    null,
  );
  const cameraOnly = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#aaa" },
  })
    .jpeg()
    .withExif({ IFD0: { Make: "Test", Model: "Without GPS" } })
    .toBuffer();
  const parsed = await readExifBlock((await sharp(cameraOnly).metadata()).exif);
  assert.equal(parsed.camera?.model, "Without GPS");
  assert.equal(parsed.gps, null);
});

test("camera parameters are readable and their strings are escaped", () => {
  assert.equal(exposureLabel(1 / 125), "1/125 s");
  assert.equal(exposureLabel(2.5), "2.5 s");
  const facts = cameraFacts({
    model: "TEST",
    fNumber: 2.8,
    exposureTime: 1 / 125,
    iso: 200,
    capturedAt: "2026-10-10T12:00:00",
  });
  assert.ok(facts.some((fact) => fact.value.includes("未记录时区")));
  const html = renderToStaticMarkup(
    createElement(PhotoFacts, {
      camera: { model: "<script>unsafe</script>", fNumber: 2.8, iso: 200 },
    }),
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /f\/2.8/);
  assert.match(html, /200/);
});

test("EXIF is extracted before output stripping and photo GPS drives the world map without a manual album point", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "landingw-exif-test-"),
  );
  try {
    const source = path.join(directory, "source.jpg");
    await fixture().jpeg().toFile(source);
    const result = await generatePhoto(source, path.join(directory, "derived"));
    assert.ok(result.metadata.camera?.model);
    assert.ok(result.metadata.gps);
    assert.equal(
      (await sharp(path.join(directory, "derived", "preview.jpg")).metadata())
        .exif,
      undefined,
    );
    const album = {
      id: "test",
      title: "测试地点，非用户旅行",
      description: "",
      date: "",
      place: "",
      latitude: null,
      longitude: null,
    };
    const photo = {
      id: "photo",
      albumId: "test",
      caption: "",
      width: 64,
      height: 48,
      thumbnail: "",
      preview: "",
      dzi: "",
      location: result.metadata.gps,
    };
    const html = renderToStaticMarkup(
      createElement(WorldMap, {
        albums: [album],
        photos: [photo],
        selected: "test",
        onSelect: () => {},
      }),
    );
    assert.equal((html.match(/class="atlas-pin/g) || []).length, 1);
    const hidden = renderToStaticMarkup(
      createElement(WorldMap, {
        albums: [album],
        photos: [{ ...photo, location: null }],
        selected: "test",
        onSelect: () => {},
      }),
    );
    assert.equal(hidden.includes('class="atlas-pin'), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
