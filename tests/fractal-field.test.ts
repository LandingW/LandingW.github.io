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
import { growthSchedule } from "../src/lib/fractal-growth";

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

test("desktop streams have distinct placements, connected geometry and valid growth parents", () => {
  const variants = buildFieldVariants(4, false);
  assert.deepEqual(variants, buildFieldVariants(4, false));
  for (const variant of variants) {
    assert.equal(
      new Set(variant.strokes.map((stroke) => stroke.id)).size,
      variant.strokes.length,
    );
    assert.equal(
      new Set(variant.strokes.map((stroke) => stroke.layoutTransform)).size,
      2,
    );
    const roots = variant.strokes.filter((stroke) => stroke.parent === null);
    assert.equal(roots.length, 2);
    for (const root of roots) {
      assert.equal((root.path.match(/M/g) || []).length, 1);
      const coords = root.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const ys = coords.filter((_, i) => i % 2 === 1);
      // The translated right stream is the tighter coverage bound.
      assert.ok(Math.min(...ys) * 1.4 <= 0);
      assert.ok(Math.max(...ys) * 1.4 - 280 >= 4 * PORTRAIT_SPAN);
    }
    const schedule = growthSchedule(variant.strokes);
    for (const stroke of variant.strokes) {
      if (stroke.parent !== null)
        assert.ok(
          schedule[stroke.id].delay + 1e-8 >=
            schedule[stroke.parent].delay + schedule[stroke.parent].duration,
        );
    }
    assert.ok(
      Math.abs(
        Math.max(...schedule.map((item) => item.delay + item.duration)) - 2000,
      ) < 1e-8,
    );
  }
});
