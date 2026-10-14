import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { INK_C, inkDensity, inkGrain, renderInk } from "../src/lib/ink-raster";
import {
  inkBufferSize,
  settleInkOffset,
  visibleInkSurfaces,
  type InkSurface,
} from "../src/lib/ink-field";
import { createInkScene } from "../src/lib/ink-scene";
import { INK_FRAGMENT } from "../src/lib/ink-renderer";

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
    "continuous ink density, not a few flat contour bands",
  );
});

test("responsive textures stay within the transfer budget and contain real transparent artwork", async () => {
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
      "art reaches all four regions instead of a center-only tile",
    );
  }
});

test("drawing buffer is capped even on high-DPI mobile and 4K displays", () => {
  for (const [width, height, dpr] of [
    [390, 844, 3],
    [1440, 900, 2],
    [3840, 2160, 3],
  ]) {
    const [w, h] = inkBufferSize(width, height, dpr);
    assert.ok(w * h < 1_502_000);
    if (width < 600) assert.equal(w, width);
  }
});

test("ink settling is monotonic, reversible and reaches a finite last frame", () => {
  assert.deepEqual(settleInkOffset(null, -80), { value: -80, moving: false });
  for (const [start, end] of [
    [0, -260],
    [-260, 0],
  ]) {
    let current = start,
      frames = 0,
      moving = true;
    while (moving && frames < 100) {
      const next = settleInkOffset(current, end);
      assert.ok(Math.abs(next.value - end) <= Math.abs(current - end));
      current = next.value;
      moving = next.moving;
      frames++;
    }
    assert.equal(current, end);
    assert.equal(moving, false);
    assert.ok(frames < 40);
  }
});

test("only six visible real paper surfaces feed a single texture pass", () => {
  const boxes = Array.from({ length: 20 }, (_, i) => ({
    x: 20,
    y: i * 120,
    width: 330,
    height: 90,
    radius: 20,
  }));
  const visible = visibleInkSurfaces(boxes, 500, 844);
  assert.equal(visible.length, 6);
  assert.equal(visible[0].y, -140);
  assert.equal((INK_FRAGMENT.match(/texture2D\(/g) || []).length, 1);
  assert.doesNotMatch(INK_FRAGMENT, /u_time|u_pointer|random|sin\(|cos\(/);
});

test("ink scene caches layout, reuploads only on source changes, handles context loss and cleans up", (t) => {
  let reads = 0,
    uploads = 0,
    draws = 0,
    disposed = 0,
    cardWidth = 330;
  let resize = () => {},
    mutation = () => {};
  let last: InkSurface[] = [];
  const canvas = Object.assign(new EventTarget(), { width: 0, height: 0 });
  const image = Object.assign(new EventTarget(), {
    complete: true,
    naturalWidth: 840,
    currentSrc: "portrait.webp",
    src: "portrait.webp",
  });
  const card = {
    getBoundingClientRect() {
      reads++;
      return { left: 20, top: 100, width: cardWidth, height: 450 };
    },
  };
  let cards = [card];
  const observed = new Set<unknown>();
  const host = {
    clientHeight: 844,
    parentElement: { querySelector: () => ({ querySelectorAll: () => cards }) },
    querySelector: (selector: string) =>
      selector === ".ink-live" ? canvas : image,
    dataset: {} as Record<string, string>,
  };
  const win = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    scrollX: 0,
    scrollY: 0,
  };
  const globals = {
    window: win,
    getComputedStyle: () => ({ borderTopLeftRadius: "24px" }),
    ResizeObserver: class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe(node: unknown) {
        observed.add(node);
      }
      unobserve(node: unknown) {
        observed.delete(node);
      }
      disconnect() {
        observed.clear();
      }
    },
    MutationObserver: class {
      constructor(cb: () => void) {
        mutation = cb;
      }
      observe() {}
      disconnect() {}
    },
  };
  const originals = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  const scene = createInkScene(host as unknown as HTMLDivElement, () => ({
    upload() {
      uploads++;
    },
    draw(_w, _h, _camera, surfaces) {
      draws++;
      last = surfaces;
    },
    dispose() {
      disposed++;
    },
  }));
  t.after(() => {
    scene.disconnect();
    for (const [key, value] of originals) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  scene.observe(() => scene.measure());
  scene.measure();
  scene.draw(0, 6000, 844);
  assert.equal(host.dataset.fieldReady, "true");
  assert.equal(uploads, 1);
  assert.equal(canvas.width, 390);
  const measured = reads;
  scene.draw(300, 6000, 844);
  assert.equal(reads, measured);
  assert.equal(last[0].y, -200);
  assert.equal(uploads, 1);
  cardWidth = 250;
  resize();
  scene.draw(0, 6000, 844);
  assert.equal(last[0].width, 250);
  image.currentSrc = "landscape.webp";
  image.dispatchEvent(new Event("load"));
  scene.draw(0, 6000, 844);
  assert.equal(uploads, 2);
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  assert.equal(host.dataset.fieldReady, undefined);
  const before = draws;
  scene.draw(0, 6000, 844);
  assert.equal(draws, before);
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  scene.draw(0, 6000, 844);
  assert.equal(host.dataset.fieldReady, "true");
  cards = [];
  mutation();
  assert.equal(observed.size, 0);
  scene.reset();
  assert.equal(host.dataset.fieldReady, undefined);
  scene.disconnect();
  const final = draws;
  resize();
  mutation();
  scene.draw(400, 6000, 844);
  assert.equal(draws, final);
  assert.ok(disposed >= 2);
  let attempts = 0;
  const unsupported = createInkScene(host as unknown as HTMLDivElement, () => {
    attempts++;
    return null;
  });
  unsupported.measure();
  unsupported.draw(0, 6000, 844);
  unsupported.draw(300, 6000, 844);
  assert.equal(
    attempts,
    1,
    "unsupported graphics does not retry on every scroll",
  );
  assert.equal(
    host.dataset.fieldReady,
    undefined,
    "the complete static image remains visible",
  );
  unsupported.disconnect();
});
