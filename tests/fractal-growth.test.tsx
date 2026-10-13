import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildFractalBranches,
  buildFractalVariants,
  growthSchedule,
  FRACTAL_TIMING,
  fractalScrollOffset,
} from "../src/lib/fractal-growth";
import GrowingFractal from "../src/components/GrowingFractal";
import { buildFieldVariants } from "../src/lib/fractal-field";
import Home from "../src/app/page";
import fs from "node:fs/promises";

test("fractal growth is deterministic, finite and starts children after their parent", () => {
  const branches = buildFractalBranches();
  assert.equal(branches.length, 254);
  assert.deepEqual(branches, buildFractalBranches());
  assert.equal(branches.filter((branch) => branch.parent === null).length, 2);
  for (const branch of branches) {
    assert.ok(!/NaN|Infinity/.test(branch.path));
    assert.ok(
      branch.width >= 2.6 && branch.opacity > 0 && branch.opacity < 0.5,
    );
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
  assert.match(html, /class="page-fractal"/);
  assert.equal((html.match(/data-fractal-pattern=/g) ?? []).length, 4);
  assert.equal(
    (html.match(/<path /g) ?? []).length,
    buildFieldVariants(2, false).reduce(
      (total, variant) => total + variant.strokes.length,
      0,
    ),
  );
  assert.match(html, /<noscript>/);
  assert.match(html, /\[data-continuous\]\{stroke-dasharray:none\}/);
  assert.equal((html.match(/class="fractal-field"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /fractal-tile/);
  assert.match(html, /linearGradient/);
  assert.doesNotMatch(html, /<canvas|<button|<a /);
});

test("one shared background lives above all homepage chapters, not inside the hero", () => {
  const html = renderToStaticMarkup(createElement(Home));
  assert.equal((html.match(/class="page-fractal"/g) || []).length, 1);
  assert.ok(html.indexOf('class="page-fractal"') < html.indexOf("<header"));
  for (const id of [
    "home",
    "experience",
    "skills",
    "articles",
    "travel",
    "contact",
  ])
    assert.ok(html.includes(`id="${id}"`));
});

test("fullscreen colored fractal has a scroll camera, lifecycle cleanup and static fallbacks", async () => {
  const css = await fs.readFile("src/app/globals.css", "utf8");
  const design = await fs.readFile("src/app/design.css", "utf8");
  const component = await fs.readFile(
    "src/components/GrowingFractal.tsx",
    "utf8",
  );
  const backdrop = css.match(/\.page-fractal\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(backdrop, /position: fixed/);
  assert.match(backdrop, /inset: 0/);
  assert.match(backdrop, /pointer-events: none/);
  assert.match(css, /height: 100lvh/);
  assert.doesNotMatch(css, /\.fractal-branch\s*\{[^}]*stroke:/);
  assert.doesNotMatch(design, /hero-fractal/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /prefers-reduced-motion/);
  assert.match(component, /graphics.*static/);
  assert.match(
    component,
    /window.addEventListener\("scroll", schedule, \{ passive: true \}\)/,
  );
  assert.match(component, /window.removeEventListener\("scroll", schedule\)/);
  assert.match(component, /cancelAnimationFrame/);
  assert.match(component, /resize.disconnect\(\)/);
  assert.match(component, /translate3d/);
  assert.doesNotMatch(component, /setInterval|preventDefault/);
});

test("scroll camera is bounded, reversible and wraps by exactly one repeated tile", () => {
  assert.equal(fractalScrollOffset(0, 700), 0);
  assert.equal(fractalScrollOffset(500, 700), -140);
  assert.equal(fractalScrollOffset(1000, 700), -280);
  assert.equal(fractalScrollOffset(500, 700), -140);
  assert.ok(Math.abs(fractalScrollOffset(3000, 700) + 140) < 1e-8);
  for (const input of [NaN, Infinity, -200])
    assert.equal(fractalScrollOffset(input, 700), 0);
  for (const height of [0, -1, NaN, Infinity])
    assert.equal(fractalScrollOffset(500, height), 0);
  for (let y = 0; y < 100000; y += 73) {
    const offset = fractalScrollOffset(y, 800);
    assert.ok(offset <= 0 && offset > -800);
  }
});
