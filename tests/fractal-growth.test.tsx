import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildFractalBranches,
  buildFractalVariants,
  growthSchedule,
  FRACTAL_TIMING,
} from "../src/lib/fractal-growth";
import GrowingFractal from "../src/components/GrowingFractal";

test("fractal growth is deterministic, finite and starts children after their parent", () => {
  const branches = buildFractalBranches();
  assert.equal(branches.length, 254);
  assert.deepEqual(branches, buildFractalBranches());
  assert.equal(branches.filter((branch) => branch.parent === null).length, 2);
  for (const branch of branches) {
    assert.ok(!/NaN|Infinity/.test(branch.path));
    assert.ok(branch.width > 0 && branch.opacity > 0 && branch.opacity < 0.3);
    if (branch.parent !== null) {
      const parent = branches[branch.parent];
      assert.equal(branch.depth, parent.depth + 1);
      assert.ok(branch.delay >= parent.delay + parent.duration);
    }
  }
  assert.ok(
    Math.max(...branches.map((branch) => branch.delay + branch.duration)) <
      6000,
  );
});

test("fractal input depth is bounded", () => {
  assert.equal(buildFractalBranches(0).length, 2);
  assert.equal(buildFractalBranches(-5).length, 2);
  assert.equal(buildFractalBranches(100).length, 510);
  assert.equal(buildFractalBranches(Number.NaN).length, 254);
});

test("four different fractals share the exact 2s / 1s / 2s cycle", () => {
  const variants = buildFractalVariants();
  assert.deepEqual(
    variants.map((variant) => variant.id),
    ["branching", "sierpinski", "koch", "dragon"],
  );
  assert.equal(FRACTAL_TIMING.grow, 2000);
  assert.equal(FRACTAL_TIMING.hold, 1000);
  assert.equal(FRACTAL_TIMING.fade, 2000);
  assert.equal(
    variants.length * Object.values(FRACTAL_TIMING).reduce((a, b) => a + b, 0),
    20000,
  );
  for (const variant of variants) {
    const timings = growthSchedule(variant.strokes);
    assert.ok(
      Math.abs(Math.min(...timings.map((timing) => timing.delay))) < 1e-8,
    );
    assert.ok(
      Math.abs(
        Math.max(...timings.map((timing) => timing.delay + timing.duration)) -
          2000,
      ) < 1e-8,
    );
    assert.ok(
      variant.strokes.every((stroke) => !/NaN|Infinity/.test(stroke.path)),
    );
    for (const stroke of variant.strokes)
      if (stroke.parent !== null) {
        const parent = timings[stroke.parent],
          child = timings[stroke.id];
        assert.ok(child.delay + 1e-8 >= parent.delay + parent.duration);
      }
  }
  assert.deepEqual(growthSchedule([]), []);
});

test("background contains four decorative SVG patterns and a no-script fallback", () => {
  const html = renderToStaticMarkup(createElement(GrowingFractal));
  assert.match(html, /aria-hidden="true"/);
  assert.equal((html.match(/data-fractal-pattern=/g) ?? []).length, 4);
  assert.equal(
    (html.match(/<path /g) ?? []).length,
    buildFractalVariants().reduce(
      (total, variant) => total + variant.strokes.length,
      0,
    ),
  );
  assert.match(html, /<noscript>/);
  assert.doesNotMatch(html, /<canvas|<button|<a /);
});
