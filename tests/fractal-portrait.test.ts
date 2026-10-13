import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildPortraitFractals,
  portraitRows,
  PORTRAIT_SPAN,
  PORTRAIT_WIDTH,
  PORTRAIT_SCROLL_RATE,
  portraitFlow,
} from "../src/lib/fractal-portrait";
import { growthSchedule } from "../src/lib/fractal-growth";

test("one portrait world covers the complete scroll range without modulo or tiled masks", async () => {
  for (const width of [320, 390, 430])
    for (const viewport of [568, 844, 932])
      for (const document of [viewport, 8000, 25000]) {
        const rows = portraitRows(width, viewport, document);
        const fieldPixels = (rows * PORTRAIT_SPAN * width) / PORTRAIT_WIDTH;
        assert.ok(
          fieldPixels - (document - viewport) * PORTRAIT_SCROLL_RATE >=
            viewport,
        );
      }
  assert.equal(portraitRows(0, 844, 9000), 2);
  const component = await fs.readFile(
    "src/components/GrowingFractal.tsx",
    "utf8",
  );
  assert.match(component, /orientation: portrait/);
  assert.equal((component.match(/className="fractal-field"/g) || []).length, 1);
  assert.doesNotMatch(component, /fractal-tile|fractalScrollOffset/);
  assert.match(
    component,
    /-Math.max\(0, window.scrollY\) \* PORTRAIT_SCROLL_RATE/,
  );
  const css = await fs.readFile("src/app/globals.css", "utf8");
  assert.match(
    css,
    /\.fractal-field\s*\{[^}]*height: auto;[^}]*mask-image: none/,
  );
  assert.doesNotMatch(css, /height: max\(220px, 32lvh\)/);
});

test("portrait composition drifts without uniform row spacing or changing existing geometry", () => {
  const centers = Array.from({ length: 30 }, (_, i) => portraitFlow(i * 160));
  assert.ok(Math.max(...centers) - Math.min(...centers) > 130);
  for (const value of centers) assert.ok(value > 120 && value < 300);
  const short = buildPortraitFractals(3);
  const long = buildPortraitFractals(12);
  for (let i = 0; i < short.length; i++) {
    const a = short[i].strokes[0].path.split("L");
    const b = long[i].strokes[0].path.split("L");
    assert.deepEqual(a.slice(0, 20), b.slice(0, 20));
    for (const stroke of long[i].strokes) {
      const coords = stroke.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const xs = coords.filter((_, index) => index % 2 === 0);
      assert.ok(
        Math.min(...xs) >= 0 && Math.max(...xs) <= PORTRAIT_WIDTH,
        short[i].id,
      );
    }
  }
});

test("portrait fractals are deterministic, narrow and connected through a document-length backbone", () => {
  const variants = buildPortraitFractals(3);
  assert.deepEqual(variants, buildPortraitFractals(3));
  assert.deepEqual(
    variants.map((v) => v.id),
    ["branching", "sierpinski", "koch", "dragon"],
  );
  for (const variant of variants) {
    const backbone = variant.strokes[0];
    assert.equal(backbone.continuous, true);
    assert.equal(
      (backbone.path.match(/M/g) || []).length,
      1,
      "one connected path, not separate tile paths",
    );
    const numbers = backbone.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const xs = numbers.filter((_, i) => i % 2 === 0),
      ys = numbers.filter((_, i) => i % 2 === 1);
    assert.ok(
      Math.min(...xs) >= 0 && Math.max(...xs) <= PORTRAIT_WIDTH,
      variant.id,
    );
    assert.ok(
      Math.min(...ys) <= 0 && Math.max(...ys) >= 3 * PORTRAIT_SPAN,
      variant.id,
    );
    const timings = growthSchedule(variant.strokes);
    assert.ok(
      Math.abs(Math.max(...timings.map((t) => t.delay + t.duration)) - 2000) <
        1e-8,
    );
    for (const branch of variant.strokes) {
      assert.ok(!/NaN|Infinity/.test(branch.path));
      if (branch.parent !== null)
        assert.ok(
          timings[branch.id].delay + 1e-8 >=
            timings[branch.parent].delay + timings[branch.parent].duration,
        );
    }
  }
});
