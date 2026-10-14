import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { INK_C, inkDensity, inkGrain, renderInk } from "../src/lib/ink-raster";
import { printScrollOffsets } from "../src/lib/print-motion";

test("selected ink study keeps the mockup Julia constant and deterministic spatial grain", () => {
  assert.deepEqual(INK_C, [-0.4, 0.6]);
  assert.equal(inkGrain(70, 90), inkGrain(70, 90));
  assert.notEqual(inkGrain(70, 90), inkGrain(71, 90));
  assert.equal(inkDensity(0.23, 0.74, 0.5), inkDensity(-0.23, -0.74, 0.5));
  const portrait = renderInk(90, 180, "portrait");
  assert.deepEqual(portrait, renderInk(90, 180, "portrait"));
  assert.notDeepEqual(portrait, renderInk(90, 180, "landscape"));
  const alphas = [...portrait].filter((_, i) => i % 4 === 3);
  assert.ok(
    new Set(alphas).size > 60,
    "continuous ink density, not flat contour bands",
  );
});

test("responsive textures retain their size budget, transparency and full composition", async () => {
  for (const [format, width, height, budget] of [
    ["landscape", 1680, 1400, 400000],
    ["portrait", 840, 1960, 330000],
  ] as const) {
    const image = await fs.readFile(`public/studies/ink-${format}.webp`);
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.equal(metadata.hasAlpha, true);
    assert.ok(image.length < budget);
    const pixels = await sharp(image).raw().toBuffer();
    const max = [0, 0, 0, 0];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const quadrant = (y > height / 2 ? 2 : 0) + (x > width / 2 ? 1 : 0);
        max[quadrant] = Math.max(
          max[quadrant],
          pixels[(y * width + x) * 4 + 3],
        );
      }
    assert.ok(
      max.every((a) => a > 20),
      "art reaches all four regions",
    );
  }
});

test("scroll travel is twenty percent faster at short, long and capped page sizes", () => {
  for (const height of [568, 720, 844, 1080])
    for (const range of [100, 3000, 25000]) {
      for (const progress of [0.1, 0.5, 1]) {
        const before = -progress * Math.min(260, height * 0.32, range * 0.075);
        const [after] = printScrollOffsets(range * progress, range, height);
        assert.ok(Math.abs(after - before * 1.2) < 1e-8);
      }
    }
});

test("faster parallax never exposes an image edge across the complete scroll range", () => {
  for (const height of [320, 568, 720, 844, 1080])
    for (const range of [100, 3000, 25000]) {
      for (let progress = 0; progress <= 1; progress += 0.025) {
        const [offset] = printScrollOffsets(range * progress, range, height);
        assert.ok(offset <= 0);
        assert.ok(height * 1.4 + offset > height + 4);
      }
    }
});

test("runtime moves one image without canvas, text measurements, masks or deformation", async () => {
  const component = await fs.readFile(
    "src/components/GrowingFractal.tsx",
    "utf8",
  );
  const controller = await fs.readFile("src/lib/print-motion.ts", "utf8");
  const css = await fs.readFile("src/app/globals.css", "utf8");
  assert.match(component, /className="ink-static print-layer"/);
  assert.match(component, /mountPrintMotion\(host.current\)/);
  assert.doesNotMatch(
    component + controller,
    /ink-scene|ink-renderer|ink-field|createInkScene|canvas|getContext|MutationObserver|getBoundingClientRect|InkSurface|pointermove/,
  );
  assert.doesNotMatch(css, /\.ink-live|data-field-ready/);
  assert.match(css, /transition: translate 450ms/);
});
