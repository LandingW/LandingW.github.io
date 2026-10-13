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
import { mountPrintMotion, printScrollOffsets } from "../src/lib/print-motion";

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
    /drawImage|setTimeout|setInterval|createRange|getBoundingClientRect|pointermove/,
  );
  assert.match(css, /transition: translate 650ms/);
  for (const file of ["src/app/home.css", "src/app/travel/canvas.css"]) {
    assert.doesNotMatch(
      await fs.readFile(file, "utf8"),
      /backdrop-filter:\s*blur/,
    );
  }
});

test("scroll camera is small, reversible, bounded and continuous across chapters", () => {
  assert.deepEqual(printScrollOffsets(0, 6000, 800), [0, 0]);
  assert.deepEqual(printScrollOffsets(3000, 6000, 800), [-128, -79.36]);
  assert.deepEqual(printScrollOffsets(6000, 6000, 800), [-256, -158.72]);
  assert.deepEqual(printScrollOffsets(9000, 6000, 800), [-256, -158.72]);
  assert.deepEqual(printScrollOffsets(-300, 6000, 800), [0, 0]);
  assert.deepEqual(printScrollOffsets(100, 100, 800), [-7.5, -4.65]);
  for (const input of [NaN, Infinity]) {
    assert.deepEqual(printScrollOffsets(input, 6000, 800), [0, 0]);
    assert.deepEqual(printScrollOffsets(200, input, 800), [0, 0]);
    assert.deepEqual(printScrollOffsets(200, 6000, input), [0, 0]);
  }
  assert.deepEqual(printScrollOffsets(200, 0, 800), [0, 0]);
  assert.deepEqual(printScrollOffsets(200, 6000, 0), [0, 0]);
  let previous = 0;
  for (let y = 0; y <= 12000; y += 1) {
    const [current] = printScrollOffsets(y, 12000, 844);
    assert.ok(current <= previous && current >= -260);
    assert.ok(Math.abs(current - previous) < 0.023);
    previous = current;
  }
});

test("scroll bursts coalesce, idle work stops, cursor is ignored and lifecycle cleans up", (t) => {
  let measurements = 0;
  let pageHeight = 6800;
  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    body: {},
    documentElement: {
      get scrollHeight() {
        measurements++;
        return pageHeight;
      },
    },
  });
  const win = Object.assign(new EventTarget(), {
    scrollY: 0,
    innerHeight: 800,
  });
  const media = Object.assign(new EventTarget(), { matches: false });
  let writes = 0;
  const positions = ["", ""];
  const layers = positions.map((_, i) => ({
    style: {
      set translate(value: string) {
        writes++;
        positions[i] = value;
      },
      removeProperty() {
        positions[i] = "";
      },
    },
  }));
  const host = {
    dataset: {} as Record<string, string>,
    querySelectorAll: () => layers,
  };
  let nextFrame = 0;
  const pending = new Map<number, () => void>();
  const flush = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback());
  };
  let resized = () => {};
  let disconnected = false;
  const globals = {
    document: doc,
    window: win,
    matchMedia: () => media,
    location: { search: "" },
    requestAnimationFrame: (callback: () => void) => {
      pending.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => pending.delete(id),
    ResizeObserver: class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    },
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
  flush();
  assert.deepEqual(positions, ["0 0.00px", "0 0.00px"]);
  const initialMeasures = measurements;
  for (let i = 0; i < 100; i++) {
    doc.dispatchEvent(new Event("pointermove"));
    win.scrollY = (i + 1) * 30;
    win.dispatchEvent(new Event("scroll"));
  }
  assert.equal(pending.size, 1, "one frame for the entire input burst");
  assert.equal(writes, 2, "no synchronous DOM writes during input");
  assert.equal(measurements, initialMeasures, "scroll does not measure layout");
  flush();
  assert.equal(pending.size, 0, "no self-scheduling idle render loop");
  assert.deepEqual(positions, ["0 -128.00px", "0 -79.36px"]);
  win.scrollY = 1500;
  win.dispatchEvent(new Event("scroll"));
  flush();
  assert.deepEqual(positions, ["0 -64.00px", "0 -39.68px"]);
  pageHeight = 3800;
  resized();
  flush();
  assert.deepEqual(positions, ["0 -112.50px", "0 -69.75px"]);
  const settledWrites = writes;
  win.dispatchEvent(new Event("scroll"));
  flush();
  assert.equal(writes, settledWrites, "unchanged offset does not write styles");
  win.dispatchEvent(new Event("scroll"));
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(host.dataset.artMotion, "paused");
  assert.equal(pending.size, 0, "backgrounding cancels pending work");
  win.dispatchEvent(new Event("scroll"));
  resized();
  assert.equal(pending.size, 0);
  doc.hidden = false;
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(host.dataset.artMotion, "running");
  media.matches = true;
  media.dispatchEvent(new Event("change"));
  assert.equal(host.dataset.artMotion, "paused");
  assert.deepEqual(positions, ["0 0.00px", "0 0.00px"]);
  win.dispatchEvent(new Event("scroll"));
  assert.equal(pending.size, 0);
  media.matches = false;
  media.dispatchEvent(new Event("change"));
  assert.equal(host.dataset.artMotion, "running");
  cleanup();
  assert.equal(disconnected, true);
  assert.equal(pending.size, 0);
  const before = writes;
  doc.dispatchEvent(new Event("visibilitychange"));
  media.dispatchEvent(new Event("change"));
  win.dispatchEvent(new Event("scroll"));
  win.dispatchEvent(new Event("resize"));
  resized();
  assert.equal(writes, before);
  assert.equal(pending.size, 0);
  globals.location.search = "?graphics=static";
  cleanup = mountPrintMotion(host as unknown as HTMLDivElement);
  assert.equal(host.dataset.artMotion, "paused");
  win.dispatchEvent(new Event("scroll"));
  assert.equal(pending.size, 0);
  assert.deepEqual(positions, ["0 0.00px", "0 0.00px"]);
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
