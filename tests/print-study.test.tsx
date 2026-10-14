import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gzipSync } from "node:zlib";
import fs from "node:fs/promises";
import GrowingFractal from "../src/components/GrowingFractal";
import {
  buildJuliaPlates,
  juliaPath,
  JULIA_VIEWBOX,
} from "../src/lib/julia-study";
import { mountPrintMotion, printScrollOffsets } from "../src/lib/print-motion";

test("Julia contours are deterministic, finite, closed and bounded in count", () => {
  for (const format of ["portrait", "landscape"] as const) {
    const art = buildJuliaPlates(format);
    assert.deepEqual(art, buildJuliaPlates(format));
    assert.equal(art.length, 2);
    const bands = art.flatMap((plate) => plate.bands);
    const curves = bands.map((band) => juliaPath(band.loops));
    assert.ok(
      bands
        .flatMap((band) => band.loops)
        .reduce((n, loop) => n + loop.length, 0) <= 6500,
    );
    assert.equal(new Set(curves).size, curves.length);
    for (const curve of curves) {
      assert.match(curve, /^M/);
      assert.match(curve, /Z$/);
      assert.match(curve, /Q/);
      assert.doesNotMatch(curve, /NaN|Infinity/);
    }
  }
});

test("phone composition has an independent vertical Julia framing", () => {
  assert.deepEqual(JULIA_VIEWBOX.portrait, [420, 900]);
  const portrait = buildJuliaPlates("portrait")[0].bands[0].loops[0];
  const wide = buildJuliaPlates("landscape")[0].bands[0].loops[0];
  const xs = portrait.map((p) => p[0]),
    ys = portrait.map((p) => p[1]);
  assert.ok(
    Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs),
  );
  assert.notEqual(portrait[0][0] / 420, wide[0][0] / 1440);
});

test("decorative ink SSR stays compact with a visible responsive fallback and no idle animation", async () => {
  const html = renderToStaticMarkup(createElement(GrowingFractal));
  assert.equal((html.match(/<picture/g) || []).length, 1);
  assert.ok(
    gzipSync(html).byteLength < 26000,
    `compressed background: ${gzipSync(html).byteLength} bytes`,
  );
  assert.doesNotMatch(
    html,
    /<canvas|<filter|<animate|<image|<script|tabindex|opacity:0|visibility:hidden/,
  );
  const css = await fs.readFile("src/app/globals.css", "utf8");
  assert.doesNotMatch(css, /@keyframes print-drift|@keyframes print-counter/);
  const controller = await fs.readFile("src/lib/print-motion.ts", "utf8");
  assert.doesNotMatch(
    controller,
    /drawImage|setTimeout|setInterval|createRange|getBoundingClientRect|pointermove/,
  );
  assert.match(css, /\.ink-static img\s*\{[^}]*height: 140%/);
  assert.match(css, /transition: translate 450ms/);
  for (const file of ["src/app/home.css", "src/app/travel/canvas.css"]) {
    assert.doesNotMatch(
      await fs.readFile(file, "utf8"),
      /backdrop-filter:\s*blur/,
    );
  }
});

test("scroll camera is small, reversible, bounded and continuous across chapters", () => {
  assert.deepEqual(printScrollOffsets(0, 6000, 800), [0, 0]);
  assert.deepEqual(printScrollOffsets(3000, 6000, 800), [-153.6, -95.232]);
  assert.deepEqual(printScrollOffsets(6000, 6000, 800), [-307.2, -190.464]);
  assert.deepEqual(printScrollOffsets(9000, 6000, 800), [-307.2, -190.464]);
  assert.deepEqual(printScrollOffsets(-300, 6000, 800), [0, 0]);
  assert.deepEqual(printScrollOffsets(100, 100, 800), [-9, -5.58]);
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
    assert.ok(current <= previous && current >= -312);
    assert.ok(Math.abs(current - previous) < 0.027);
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
  let clock = 0,
    sceneDraws = 0,
    sceneResets = 0,
    sceneDisconnected = false,
    scenePending = 0;
  const pending = new Map<number, (now: number) => void>();
  const flush = (elapsed = 40) => {
    clock += elapsed;
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(clock));
  };
  let resized = () => {};
  let disconnected = false;
  const globals = {
    document: doc,
    window: win,
    matchMedia: () => media,
    location: { search: "" },
    requestAnimationFrame: (callback: (now: number) => void) => {
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
  cleanup = mountPrintMotion(host as unknown as HTMLDivElement, {
    minFrameMs: 1000 / 30,
    observe() {},
    measure() {},
    draw() {
      sceneDraws++;
      return --scenePending > 0;
    },
    reset() {
      sceneResets++;
    },
    disconnect() {
      sceneDisconnected = true;
    },
  });
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
  assert.deepEqual(positions, ["0 -153.60px", "0 -95.23px"]);
  win.scrollY = 1500;
  win.dispatchEvent(new Event("scroll"));
  flush();
  assert.deepEqual(positions, ["0 -76.80px", "0 -47.62px"]);
  pageHeight = 3800;
  resized();
  flush();
  assert.deepEqual(positions, ["0 -135.00px", "0 -83.70px"]);
  const settledWrites = writes;
  win.dispatchEvent(new Event("scroll"));
  flush();
  assert.equal(writes, settledWrites, "unchanged offset does not write styles");
  const beforeThrottle = sceneDraws;
  win.scrollY = 1600;
  win.dispatchEvent(new Event("scroll"));
  flush(10);
  assert.equal(
    sceneDraws,
    beforeThrottle,
    "shape updates respect the 30 Hz budget",
  );
  assert.equal(pending.size, 1);
  flush(24);
  assert.equal(
    sceneDraws,
    beforeThrottle + 1,
    "the final input is not dropped",
  );
  assert.equal(
    pending.size,
    0,
    "trailing frame stops instead of becoming an idle loop",
  );
  scenePending = 3;
  win.dispatchEvent(new Event("scroll"));
  flush();
  assert.equal(pending.size, 1, "a scene may request a bounded settling frame");
  flush();
  flush();
  assert.equal(pending.size, 0, "settling stops on the final scene frame");
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
  assert.equal(sceneDisconnected, true);
  assert.ok(sceneResets > 0);
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
