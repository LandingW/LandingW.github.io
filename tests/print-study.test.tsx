import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gzipSync } from "node:zlib";
import fs from "node:fs/promises";
import GrowingFractal from "../src/components/GrowingFractal";
import {
  buildPrint,
  printForms,
  printCurve,
  PRINT_VIEWBOX,
} from "../src/lib/print-study";
import { mountPrintMotion } from "../src/lib/print-motion";

test("plotter geometry is deterministic, finite, closed and bounded in count", () => {
  for (const format of ["portrait", "landscape"] as const) {
    const art = buildPrint(format);
    assert.deepEqual(art, buildPrint(format));
    assert.equal(art.length, 2);
    const curves = art.flatMap((layer) => layer.flatMap((form) => form.curves));
    assert.ok(curves.length <= 60);
    assert.equal(new Set(curves).size, curves.length);
    for (const curve of curves) {
      assert.match(curve, /^M/);
      assert.match(curve, /Z$/);
      assert.equal((curve.match(/C/g) || []).length, 12);
      assert.doesNotMatch(curve, /NaN|Infinity/);
    }
    const form = printForms(format)[0][0];
    assert.equal(printCurve(form, -1), printCurve(form, 0));
    assert.equal(printCurve(form, 1000), printCurve(form, form.rings - 1));
  }
});

test("phone composition uses its own tall space and smaller family sizes", () => {
  assert.equal(PRINT_VIEWBOX.portrait, "0 0 420 900");
  const portrait = printForms("portrait").flat(),
    wide = printForms("landscape").flat();
  assert.ok(portrait.every((form) => form.rx < 180 && form.rings < 18));
  assert.ok(portrait.some((form) => form.x - form.rx < 0));
  assert.ok(portrait.some((form) => form.x + form.rx > 420));
  assert.ok(portrait.some((form) => form.y - form.ry < 0));
  assert.ok(portrait.some((form) => form.y + form.ry > 900));
  assert.notEqual(portrait[0].x / 420, wide[0].x / 1440);
});

test("decorative SSR stays compact and visible with only two transform layers", async () => {
  const html = renderToStaticMarkup(createElement(GrowingFractal));
  assert.equal((html.match(/class="print-layer /g) || []).length, 2);
  assert.ok(
    gzipSync(html).byteLength < 26000,
    `compressed background: ${gzipSync(html).byteLength} bytes`,
  );
  assert.doesNotMatch(
    html,
    /<canvas|<filter|<animate|<image|<script|tabindex|opacity:0|visibility:hidden/,
  );
  const css = await fs.readFile("src/app/globals.css", "utf8");
  for (const name of ["print-drift", "print-counter"]) {
    const frames = css
      .split(`@keyframes ${name}`)[1]
      .split("@keyframes")[0]
      .split("@media")[0];
    assert.match(frames, /translate3d/);
    assert.doesNotMatch(frames, /opacity:|filter:|stroke-|width:|height:/);
  }
  const controller = await fs.readFile("src/lib/print-motion.ts", "utf8");
  assert.doesNotMatch(
    controller,
    /requestAnimationFrame|drawImage|setTimeout|setInterval|createRange|getBoundingClientRect|ResizeObserver|pointermove/,
  );
  for (const file of ["src/app/home.css", "src/app/travel/canvas.css"]) {
    assert.doesNotMatch(
      await fs.readFile(file, "utf8"),
      /backdrop-filter:\s*blur/,
    );
  }
});

test("plate controller reacts only to visibility/preferences, not cursor or scroll, and cleans up", (t) => {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const media = Object.assign(new EventTarget(), { matches: false });
  let writes = 0;
  const host = {
    dataset: new Proxy({} as Record<string, string>, {
      set(obj, key, value) {
        writes++;
        obj[String(key)] = value;
        return true;
      },
    }),
  };
  const globals = {
    document: doc,
    matchMedia: () => media,
    location: { search: "" },
  };
  const original = Object.keys(globals).map(
    (k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const,
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  let cleanup = () => {};
  t.after(() => {
    cleanup();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  cleanup = mountPrintMotion(host as unknown as HTMLDivElement);
  assert.equal(host.dataset.artMotion, "running");
  for (let i = 0; i < 100; i++) {
    doc.dispatchEvent(new Event("pointermove"));
    doc.dispatchEvent(new Event("scroll"));
  }
  assert.equal(writes, 1, "no per-input or recurring DOM work");
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(host.dataset.artMotion, "paused");
  doc.hidden = false;
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(host.dataset.artMotion, "running");
  media.matches = true;
  media.dispatchEvent(new Event("change"));
  assert.equal(host.dataset.artMotion, "paused");
  media.matches = false;
  media.dispatchEvent(new Event("change"));
  assert.equal(host.dataset.artMotion, "running");
  cleanup();
  const before = writes;
  doc.dispatchEvent(new Event("visibilitychange"));
  media.dispatchEvent(new Event("change"));
  assert.equal(writes, before);
  globals.location.search = "?graphics=static";
  cleanup = mountPrintMotion(host as unknown as HTMLDivElement);
  assert.equal(host.dataset.artMotion, "paused");
});

test("normal hover feedback survives but no component follows cursor coordinates", async () => {
  const source = await fs.readFile("src/components/SiteMotion.tsx", "utf8");
  assert.doesNotMatch(source, /pointermove|clientX|clientY|pointerOffset/);
  const css = await fs.readFile("src/app/motion.css", "utf8");
  assert.doesNotMatch(css, /--motion-x|--motion-y|--motion-zoom/);
  assert.match(css, /\.button:active/);
  const teapot = await fs.readFile("src/components/TeapotStudy.tsx", "utf8");
  assert.match(teapot, /if \(!drag \|\| drag.id !== event.pointerId\) return/);
});
