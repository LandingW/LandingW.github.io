import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  albumInput,
  mediaUrl,
  parseManifest,
  serviceUrl,
  EMPTY_MANIFEST,
} from "../src/lib/travel";
import { generatePhoto } from "../scripts/photo-processing";
import WorldMap from "../src/components/travel/WorldMap";

test("travel data accepts only explicit locations, real dates and safe service URLs", () => {
  assert.equal(albumInput({ title: "Journey" }).latitude, null);
  assert.throws(() => albumInput({ title: "Journey", date: "2026-02-30" }));
  assert.throws(() => albumInput({ title: "Journey", latitude: 35 }));
  assert.throws(() =>
    albumInput({ title: "Journey", latitude: 20, longitude: 181 }),
  );
  assert.throws(() => serviceUrl("javascript:alert(1)"));
  assert.throws(() => serviceUrl("https://user:secret@example.com"));
  assert.throws(() => serviceUrl("http://example.com"));
  assert.equal(serviceUrl("http://127.0.0.1:3001/"), "http://127.0.0.1:3001");
  assert.throws(() =>
    mediaUrl("https://media.example.com", "../originals/a/source"),
  );
  assert.deepEqual(parseManifest(EMPTY_MANIFEST), EMPTY_MANIFEST);
});

test("the world atlas has real geometry and does not invent visited places", () => {
  const empty = renderToStaticMarkup(
    createElement(WorldMap, { albums: [], selected: "", onSelect: () => {} }),
  );
  assert.match(empty, /atlas-land/);
  assert.equal(empty.includes('class="atlas-pin'), false);
  const marked = renderToStaticMarkup(
    createElement(WorldMap, {
      albums: [
        {
          id: "test",
          ...albumInput({
            title: "测试坐标，非真实旅行",
            latitude: 0,
            longitude: 0,
          }),
        },
      ],
      selected: "test",
      onSelect: () => {},
    }),
  );
  assert.equal((marked.match(/class="atlas-pin/g) || []).length, 1);
});

test("libvips produces Deep Zoom tiles, normalizes orientation and strips EXIF", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "landingw-photo-test-"));
  try {
    const input = path.join(temp, "input.jpg"),
      output = path.join(temp, "output");
    await sharp({
      create: { width: 1025, height: 777, channels: 3, background: "#dd6655" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(input);
    assert.ok((await sharp(input).metadata()).exif);
    const result = await generatePhoto(input, output);
    assert.equal(result.width, 777);
    assert.equal(result.height, 1025);
    const xml = await fs.readFile(path.join(output, "image.dzi"), "utf8");
    assert.match(xml, /TileSize="512"/);
    assert.match(xml, /Overlap="1"/);
    assert.match(xml, /Width="777"/);
    assert.match(xml, /Height="1025"/);
    assert.ok(result.tileCount > 6 && result.derivedBytes > 0);
    assert.ok(
      result.files.every((file) => !file.endsWith("vips-properties.xml")),
    );
    for (const file of result.files.filter((file) => /\.jpe?g$/.test(file))) {
      const metadata = await sharp(path.join(output, file)).metadata();
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.xmp, undefined);
      if (file.startsWith("image_files/"))
        assert.ok(metadata.width! <= 514 && metadata.height! <= 514);
    }
    await assert.rejects(() => generatePhoto(input, output), /必须为空/);
    const invalid = path.join(temp, "invalid.jpg");
    await fs.writeFile(invalid, "not an image");
    await assert.rejects(() =>
      generatePhoto(invalid, path.join(temp, "invalid-output")),
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test("photo processing stays separate from Pages and uploads no image artifacts", async () => {
  const workflow = await fs.readFile(".github/workflows/photos.yml", "utf8");
  const deployment = await fs.readFile(".github/workflows/deploy.yml", "utf8");
  assert.match(workflow, /npm run photos:process/);
  assert.doesNotMatch(
    workflow,
    /npm run build|git push|upload-artifact|upload-pages-artifact/,
  );
  assert.doesNotMatch(deployment, /Process Travel Photos/);
});

test("cloud smoke verification refuses real photo IDs before any network or cleanup", () => {
  for (const PHOTO_ID of [
    "12345678-1234-1234-1234-123456789012",
    "smoke-../../photos",
    "",
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/photo-smoke.ts", "guard"],
      { env: { ...process.env, PHOTO_ID }, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
  }
  const valid = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/photo-smoke.ts", "guard"],
    {
      env: {
        ...process.env,
        PHOTO_ID: "smoke-12345678-1234-1234-1234-123456789012",
      },
      encoding: "utf8",
    },
  );
  assert.equal(valid.status, 0);
});
