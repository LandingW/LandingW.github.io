import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import GrowingFractal from "../src/components/GrowingFractal";
import TravelPage from "../src/app/travel/page";
import { renderSand, SAND_FORMS, SAND_SEED } from "../src/lib/sand-raster";

test("selected sand study preserves the sample seed, grain and independent portrait composition", () => {
  assert.equal(SAND_SEED, 2887);
  assert.notDeepEqual(SAND_FORMS.landscape, SAND_FORMS.portrait);
  const pixels = renderSand(100, 160, "portrait");
  assert.deepEqual(pixels, renderSand(100, 160, "portrait"));
  assert.notDeepEqual(pixels, renderSand(100, 160, "landscape"));
  const alphas = pixels.filter((_, i) => i % 4 === 3);
  assert.ok(new Set(alphas).size > 80, "granular density is not a flat fill");
  assert.ok(alphas.filter((a) => a === 0).length > alphas.length * 0.3);
  assert.throws(() => renderSand(0, 160, "portrait"), RangeError);
  assert.throws(() => renderSand(Infinity, 160, "portrait"), RangeError);
});

test("travel selects sand while the homepage keeps ink and no renderer enters SSR", () => {
  const travel = renderToStaticMarkup(createElement(TravelPage));
  const home = renderToStaticMarkup(createElement(GrowingFractal));
  assert.match(travel, /data-renderer="sand-ring-scroll"/);
  assert.match(travel, /srcSet="\/studies\/sand-portrait.webp"/);
  assert.match(travel, /src="\/studies\/sand-landscape.webp"/);
  assert.match(travel, /media="\(orientation: portrait\)"/);
  assert.equal((travel.match(/class="page-fractal"/g) || []).length, 1);
  assert.doesNotMatch(
    travel,
    /ink-(?:portrait|landscape)\.webp|<canvas|<filter|<animate/,
  );
  assert.match(home, /data-renderer="julia-ink-scroll"/);
  assert.match(home, /ink-portrait.webp/);
  assert.doesNotMatch(home, /sand-/);
});

test("sand images are transparent, compact, and reach every region without tiling", async () => {
  for (const [format, width, height, budget] of [
    ["landscape", 1680, 1400, 430000],
    ["portrait", 840, 1960, 360000],
  ] as const) {
    const image = await fs.readFile(`public/studies/sand-${format}.webp`);
    const meta = await sharp(image).metadata();
    assert.equal(meta.width, width);
    assert.equal(meta.height, height);
    assert.equal(meta.hasAlpha, true);
    assert.ok(image.length < budget, `${format}: ${image.length} bytes`);
    const raw = await sharp(image).raw().toBuffer();
    const quadrants = [0, 0, 0, 0];
    let empty = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const alpha = raw[(y * width + x) * 4 + 3];
        quadrants[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)] +=
          alpha;
        if (!alpha) empty++;
      }
    assert.ok(
      quadrants.every((sum) => sum / ((width * height) / 4) > 1),
      "each quadrant contains art; the upper-left intentionally has more negative space",
    );
    assert.ok(
      empty > width * height * 0.3,
      "keep the negative space between rings",
    );
  }
});

test("public travel reading surfaces are opaque and the drawing remains build-time only", async () => {
  const css = await fs.readFile("src/app/travel/canvas.css", "utf8");
  for (const selector of [".travel-intro > div", ".journey-section-heading"]) {
    const rule = css.slice(css.indexOf(selector)).split("}")[0];
    assert.match(rule, /background: var\(--home-surface\)/);
    assert.match(rule, /border-radius:/);
    assert.doesNotMatch(rule, /text-shadow|filter:/);
  }
  const component = await fs.readFile(
    "src/components/GrowingFractal.tsx",
    "utf8",
  );
  assert.doesNotMatch(
    component,
    /sand-raster|renderSand|canvas|getContext|pointermove/,
  );
  assert.match(component, /mountPrintMotion\(host.current\)/);
  const manager = await fs.readFile("src/app/travel/manage/page.tsx", "utf8");
  assert.doesNotMatch(manager, /GrowingFractal|sand-ring/);
});
