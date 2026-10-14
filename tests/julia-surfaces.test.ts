import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { juliaEscape } from "../src/lib/julia-math";
import data from "../src/lib/generated/julia-study.json";
import {
  bendJuliaPoint,
  buildJuliaPlates,
  juliaPath,
} from "../src/lib/julia-study";
import { createJuliaScene } from "../src/lib/julia-surfaces";

test("Julia data comes from complex iteration and static artwork matches the same contours", async () => {
  assert.equal(juliaEscape(0, 0, 0, 0), 160);
  assert.ok(juliaEscape(2, 0, 0, 0) < 10);
  assert.deepEqual(data.c, [-0.8, 0.156]);
  for (const band of data.bands) {
    const [x, y] = band.loops[0][0];
    const real = (x / 1000 - 0.5) * 3.5,
      imag = (y / 1000 - 0.5) * 3.5;
    // Marching squares interpolates a sampled field, not the arbitrarily steep
    // continuous high-iteration boundary. The local grid must bracket its level.
    const values: number[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        values.push(
          juliaEscape(
            ((Math.round(x / 1.25) + dx) / 800 - 0.5) * 3.5,
            ((Math.round(y / 1.25) + dy) / 800 - 0.5) * 3.5,
            ...(data.c as [number, number]),
          ),
        );
    assert.ok(
      Math.min(...values) <= band.level && Math.max(...values) >= band.level,
    );
    assert.equal(
      juliaEscape(real, imag, ...(data.c as [number, number])),
      juliaEscape(-real, -imag, ...(data.c as [number, number])),
    );
  }
  for (const format of ["landscape", "portrait"] as const) {
    let bytes = 0;
    for (const [index, plate] of buildJuliaPlates(format).entries()) {
      const svg = await fs.readFile(
        `public/studies/julia-${format}-${index}.svg`,
        "utf8",
      );
      bytes += gzipSync(svg).byteLength;
      for (const band of plate.bands)
        assert.ok(svg.includes(juliaPath(band.loops)));
      assert.doesNotMatch(svg, /script|filter|image|http[^s].*href/);
    }
    assert.ok(bytes < 65000, `compressed SVG pair: ${bytes} bytes`);
  }
});

test("paper margins deflect contours locally, smoothly, reversibly and without fold-over", () => {
  const box = { x: 100, y: 100, width: 300, height: 400, radius: 32 };
  assert.deepEqual(bendJuliaPoint([0, 300], [box]), [0, 300]);
  assert.deepEqual(bendJuliaPoint([250, 300], [box]), [250, 300]);
  assert.ok(bendJuliaPoint([90, 300], [box])[0] < 90);
  assert.ok(bendJuliaPoint([410, 300], [box])[0] > 410);
  const corner = bendJuliaPoint([96, 96], [box]);
  assert.ok(corner[0] < 96 && corner[1] < 96);
  const small = { x: 100, y: 100, width: 300, height: 40, radius: 12 };
  for (let y = 80; y < 160; y += 0.5)
    assert.ok(
      bendJuliaPoint([250, y + 0.5], [small])[1] >
        bendJuliaPoint([250, y], [small])[1],
      "thin text surfaces must not create a centerline discontinuity",
    );
  let previous = -Infinity;
  for (let x = 10; x < 185; x += 0.5) {
    const point = bendJuliaPoint([x, 300], [box]);
    assert.ok(
      point[0] > previous,
      "a single straight margin must not fold the field",
    );
    assert.ok(Math.abs(point[0] - x) <= 84 * 0.38 + 1e-6);
    previous = point[0];
  }
  assert.deepEqual(
    bendJuliaPoint([90, 300], [box]),
    bendJuliaPoint([90, 300], [box]),
  );
  assert.notDeepEqual(
    bendJuliaPoint([90, 300], [box]),
    bendJuliaPoint([90, 300], [{ ...box, x: 130 }]),
  );
});

test("scene follows real surface geometry, reuses cached layout on scroll and cleans up observers", (t) => {
  let reads = 0,
    writes = 0,
    top = 150,
    cardWidth = 330,
    removed = 0;
  let notifyResize = () => {},
    notifyMutation = () => {};
  const observed = new Set<unknown>();
  const card = {
    getBoundingClientRect() {
      reads++;
      return { left: 20, top, width: cardWidth, height: 500 };
    },
  };
  let cards = [card];
  const main = { querySelectorAll: () => cards };
  const pathRows = [3, 2].map((n) =>
    Array.from({ length: n }, () => ({
      d: "",
      setAttribute(_name: string, value: string) {
        writes++;
        this.d = value;
      },
    })),
  );
  const svgs = pathRows.map((paths) => ({
    querySelectorAll: () => paths,
    setAttribute() {},
  }));
  const host = {
    parentElement: { querySelector: () => main },
    querySelectorAll: () => svgs,
    dataset: {} as Record<string, string>,
  };
  const win = { innerWidth: 390, innerHeight: 844, scrollX: 0, scrollY: 0 };
  const globals = {
    window: win,
    getComputedStyle: () => ({ borderTopLeftRadius: "32px" }),
    ResizeObserver: class {
      constructor(callback: () => void) {
        notifyResize = callback;
      }
      observe(node: unknown) {
        observed.add(node);
      }
      unobserve(node: unknown) {
        observed.delete(node);
        removed++;
      }
      disconnect() {
        observed.clear();
        removed++;
      }
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        notifyMutation = callback;
      }
      observe() {}
      disconnect() {
        removed++;
      }
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
  const scene = createJuliaScene(host as unknown as HTMLDivElement);
  t.after(() => {
    scene.disconnect();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  assert.equal(scene.minFrameMs, 1000 / 30);
  scene.observe(() => scene.measure());
  scene.measure();
  scene.draw(0, 6000, 844);
  assert.equal(host.dataset.fieldReady, "true");
  const initial = pathRows
    .map((row) => row.map((p) => p.d))
    .flat()
    .join();
  const measured = reads,
    initialWrites = writes;
  scene.draw(0, 6000, 844);
  assert.equal(writes, initialWrites);
  scene.draw(300, 6000, 844);
  assert.equal(reads, measured, "scroll never measures panels");
  assert.notEqual(
    pathRows
      .map((row) => row.map((p) => p.d))
      .flat()
      .join(),
    initial,
  );
  scene.draw(0, 6000, 844);
  assert.equal(
    pathRows
      .map((row) => row.map((p) => p.d))
      .flat()
      .join(),
    initial,
  );
  cardWidth = 250;
  top = 190;
  notifyResize();
  scene.draw(0, 6000, 844);
  assert.notEqual(
    pathRows
      .map((row) => row.map((p) => p.d))
      .flat()
      .join(),
    initial,
  );
  cards = [];
  notifyMutation();
  assert.equal(observed.size, 0);
  scene.reset();
  assert.equal(host.dataset.fieldReady, undefined);
  scene.disconnect();
  const finalWrites = writes,
    finalReads = reads;
  notifyResize();
  notifyMutation();
  scene.draw(400, 6000, 844);
  assert.equal(writes, finalWrites);
  assert.equal(reads, finalReads);
  assert.ok(removed >= 3);
});
