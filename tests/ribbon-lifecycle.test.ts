import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mountTypographicField } from "../src/lib/typographic-field";

/** Deterministic controller integration: real draw loop, fake DOM/canvas boundary. */
function setup(
  t: TestContext,
  options: { reduced?: boolean; static?: boolean } = {},
) {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0,
    paints = 0,
    allocations = 0,
    observerCleanups = 0,
    lines = 0;
  const phases = new Set<string>();
  const listeners = new Set<EventListenerOrEventListenerObject>();
  class Target extends EventTarget {
    override addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: AddEventListenerOptions | boolean,
    ) {
      if (listener) listeners.add(listener);
      super.addEventListener(type, listener, options);
    }
    override removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean,
    ) {
      if (listener) listeners.delete(listener);
      super.removeEventListener(type, listener, options);
    }
  }
  const reduced = Object.assign(new Target(), { matches: !!options.reduced });
  const fine = Object.assign(new Target(), { matches: true });
  const paint = {
    fillStyle: "",
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {},
  };
  const context = {
    fillStyle: "",
    setTransform() {},
    fillRect() {
      assert.equal(this.fillStyle, "#f7f5ef");
      paints++;
    },
    drawImage() {
      lines++;
    },
  };
  const size = { width: 390, height: 844 };
  const dimensions = { width: 0, height: 0 };
  const canvas = {
    get width() {
      return dimensions.width;
    },
    set width(value: number) {
      dimensions.width = value;
      allocations++;
    },
    get height() {
      return dimensions.height;
    },
    set height(value: number) {
      dimensions.height = value;
      allocations++;
    },
    getContext(type: string, config: unknown) {
      assert.equal(type, "2d");
      assert.deepEqual(config, { alpha: false });
      return context;
    },
  };
  const heading = {
    textContent: "Title",
    getAttribute: () => null,
    getBoundingClientRect: () => ({
      left: 30,
      top: 200,
      bottom: 260,
      width: 200,
      height: 60,
    }),
  };
  const root = { querySelectorAll: () => [heading] };
  const host = {
    parentElement: root,
    dataset: {} as Record<string, string>,
    getBoundingClientRect: () => size,
  };
  const doc = Object.assign(new Target(), {
    hidden: false,
    fonts: { ready: Promise.resolve() },
    createElement: () => ({ width: 0, height: 0, getContext: () => paint }),
    createTreeWalker: () => ({ nextNode: () => null }),
    createRange: () => ({}),
  });
  const win = new Target();
  const observerCallbacks: (() => void)[] = [];
  class Observer {
    constructor(callback: () => void) {
      observerCallbacks.push(callback);
    }
    observe() {}
    disconnect() {
      observerCleanups++;
    }
  }
  const globals = {
    document: doc,
    window: win,
    location: { search: options.static ? "?graphics=static" : "" },
    scrollY: 0,
    devicePixelRatio: 3,
    NodeFilter: { SHOW_TEXT: 4 },
    matchMedia: (query: string) => (query.includes("reduced") ? reduced : fine),
    ResizeObserver: Observer,
    MutationObserver: Observer,
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      frames.set(++next, fn);
      return next;
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id);
    },
  };
  const descriptors = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
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
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const dispose = mountTypographicField(
    host as unknown as HTMLDivElement,
    canvas as unknown as HTMLCanvasElement,
  );
  cleanup = dispose;
  const tick = (time: number) => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn(time));
    if (host.dataset.phase) phases.add(host.dataset.phase);
  };
  const pointer = (type: string) =>
    doc.dispatchEvent(
      Object.assign(new Event("pointermove"), {
        pointerType: type,
        clientX: 80,
        clientY: 300,
      }),
    );
  return {
    tick,
    dispose,
    host,
    doc,
    win,
    reduced,
    frames,
    phases,
    size,
    canvas,
    pointer,
    observerCallbacks,
    stats: () => ({
      paints,
      allocations,
      observerCleanups,
      lines,
      listeners: listeners.size,
    }),
  };
}

test("continuous controller crosses all morph phases for 40s without canvas resize or frontend style writes", async (t) => {
  const f = setup(t);
  await Promise.resolve();
  for (let time = 1; time < 40000; time += 34) f.tick(time);
  assert.deepEqual([...f.phases].sort(), ["gather", "hold", "release"]);
  assert.equal(
    f.stats().allocations,
    2,
    "only the initial width and height allocation",
  );
  assert.ok(f.stats().paints > 1000);
  assert.equal(f.stats().lines, f.stats().paints * f.canvas.height * 3);
  assert.equal(f.host.dataset.ready, "true");
  assert.equal(f.host.dataset.fieldHeading, "Title");
  assert.equal(f.canvas.width, 585, "phone DPR capped at 1.5");
  f.pointer("touch");
  assert.equal(f.host.dataset.pointer, undefined);
  f.pointer("mouse");
  assert.equal(f.host.dataset.pointer, "active");
  f.dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(f.stats().listeners, 0);
  assert.equal(f.stats().observerCleanups, 2);
});

test("visibility suspends rendering; reading/layout events never reallocate an unchanged canvas", async (t) => {
  const f = setup(t);
  await Promise.resolve();
  f.tick(1);
  f.doc.hidden = true;
  f.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.frames.size, 0);
  const before = f.stats().paints;
  f.win.dispatchEvent(new Event("scroll"));
  f.tick(10000);
  assert.equal(f.stats().paints, before);
  f.doc.hidden = false;
  f.doc.dispatchEvent(new Event("visibilitychange"));
  f.tick(20000);
  assert.equal(f.stats().paints, before + 1);
  for (let i = 0; i < 10; i++) {
    f.win.dispatchEvent(new Event("scroll"));
    f.tick(20040 + i * 34);
  }
  assert.equal(f.stats().allocations, 2);
  f.size.width = 430;
  f.observerCallbacks[0]();
  f.tick(21000);
  assert.equal(f.stats().allocations, 4);
});

for (const options of [{ reduced: true }, { static: true }])
  test(`static rendering does not animate or respond to pointer ${JSON.stringify(options)}`, async (t) => {
    const f = setup(t, options);
    await Promise.resolve();
    f.tick(1);
    assert.equal(f.frames.size, 0);
    assert.equal(f.host.dataset.growth, "static");
    f.pointer("mouse");
    f.tick(1000);
    assert.equal(f.stats().paints, 1);
    f.win.dispatchEvent(new Event("resize"));
    f.tick(2000);
    assert.equal(f.frames.size, 0);
    assert.equal(f.stats().allocations, 2);
  });

test("photo-viewer hiding the background suspends drawing until the surface is visible again", async (t) => {
  const f = setup(t);
  await Promise.resolve();
  f.tick(1);
  f.size.width = 0;
  f.size.height = 0;
  f.observerCallbacks[0]();
  f.tick(40);
  assert.equal(f.frames.size, 0);
  assert.equal(f.stats().paints, 1);
  f.size.width = 390;
  f.size.height = 844;
  f.observerCallbacks[0]();
  f.tick(80);
  assert.equal(f.stats().paints, 2);
  assert.equal(f.stats().allocations, 2);
  assert.equal(f.frames.size, 1);
});
