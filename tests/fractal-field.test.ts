import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFieldVariants,
  fieldRows,
  LANDSCAPE_WIDTH,
} from "../src/lib/fractal-field";
import {
  PORTRAIT_SPAN,
  PORTRAIT_SCROLL_RATE,
  PORTRAIT_WIDTH,
} from "../src/lib/fractal-portrait";
import {
  terrainValue,
  terrainFbm,
  TERRAIN_STUDIES,
  traceContours,
} from "../src/lib/fractal-terrain";

test("adaptive fields cover long pages at desktop, landscape and portrait widths", () => {
  for (const [width, viewport, portrait] of [
    [320, 740, true],
    [390, 844, true],
    [740, 390, false],
    [1280, 720, false],
    [1920, 1080, false],
  ] as const) {
    for (const document of [viewport, 9000, 25000]) {
      const rows = fieldRows(width, viewport, document, portrait);
      const canvasHeight =
        (rows * PORTRAIT_SPAN * width) /
        (portrait ? PORTRAIT_WIDTH : LANDSCAPE_WIDTH);
      assert.ok(
        canvasHeight >= viewport + (document - viewport) * PORTRAIT_SCROLL_RATE,
      );
    }
  }
});

test("terrain studies cover the field without mirrored lanes and remain deterministic", () => {
  const variants = buildFieldVariants(4, false);
  assert.deepEqual(variants, buildFieldVariants(4, false));
  assert.deepEqual(
    variants.map((variant) => variant.id),
    TERRAIN_STUDIES,
  );
  assert.equal(
    new Set(variants.map((variant) => variant.contours[0].path)).size,
    4,
  );
  for (const variant of variants) {
    assert.ok(
      variant.contours.length < 300,
      "bounded number of animated elements",
    );
    const occupancy = new Set<string>();
    for (const contour of variant.contours) {
      assert.ok(!/NaN|Infinity/.test(contour.path));
      assert.equal((contour.path.match(/M/g) || []).length, 1);
      assert.match(contour.path, /Q/);
      const coords = contour.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      for (let i = 0; i < coords.length; i += 2)
        occupancy.add(
          `${Math.floor(coords[i] / (LANDSCAPE_WIDTH / 3))},${Math.floor(coords[i + 1] / PORTRAIT_SPAN)}`,
        );
    }
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 4; y++)
        assert.ok(
          occupancy.has(`${x},${y}`),
          `${variant.id} covers column ${x}, row ${y}`,
        );
  }
});

test("field function is continuous in world space and genuinely contains multiple scales", () => {
  let multiscaleDifference = 0;
  for (let i = 0; i < 100; i++) {
    const x = i * 0.173,
      y = i * 0.319;
    multiscaleDifference += Math.abs(terrainFbm(x, y, 1) - terrainFbm(x, y, 4));
    for (const study of TERRAIN_STUDIES) {
      const value = terrainValue(x, y, study);
      assert.ok(Number.isFinite(value));
      assert.equal(terrainValue(x, y, study), value);
      assert.ok(Math.abs(terrainValue(x, y + 0.00001, study) - value) < 0.001);
    }
  }
  assert.ok(multiscaleDifference > 1);
});

test("marching contours are closed or end at the outer field boundary, never at a cell seam", () => {
  const size = 50;
  const samples = new Float64Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      samples[y * size + x] = terrainValue(x / 10, y / 10, "alluvial");
  const onEdge = ([x, y]: readonly number[]) =>
    x === 0 || y === 0 || x === size - 1 || y === size - 1;
  for (const level of [-0.2, -0.1, 0, 0.1, 0.2]) {
    const contours = traceContours(samples, size, size, 1, [0, 0], level);
    assert.ok(contours.length > 0);
    for (const contour of contours) {
      if (!contour.closed) {
        assert.ok(onEdge(contour.points[0]));
        assert.ok(onEdge(contour.points.at(-1)!));
      }
      for (let i = 1; i < contour.points.length; i++)
        assert.ok(
          Math.hypot(
            contour.points[i][0] - contour.points[i - 1][0],
            contour.points[i][1] - contour.points[i - 1][1],
          ) <=
            Math.SQRT2 + 1e-8,
        );
    }
  }
});

test("portrait uses its own feature scale and has smooth legible contours", () => {
  const portrait = buildFieldVariants(2, true);
  const landscape = buildFieldVariants(2, false);
  assert.notEqual(portrait[0].contours[0].path, landscape[0].contours[0].path);
  for (const variant of portrait)
    for (const contour of variant.contours) {
      assert.ok(contour.length >= 46);
      assert.ok(contour.weight >= 0.7 && contour.weight <= 1.35);
      assert.ok(contour.opacity <= 0.34);
    }
  assert.deepEqual(buildFieldVariants(NaN, true), portrait);
});
