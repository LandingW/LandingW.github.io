import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  FIELD_CYCLE,
  RIBBON_STUDIES,
  fieldBlend,
  ribbonCenter,
  ribbonSamples,
  ribbonPigment,
  glyphEnvelope,
  type RibbonInput,
} from "../src/lib/ribbon-field";

const scene: RibbonInput = {
  width: 1280,
  height: 720,
  elapsed: 2500,
  scroll: 0,
  heading: { x: 300, y: 330, width: 360, height: 180, strength: 1 },
  pointer: { x: -1000, y: -1000, active: 0 },
};

test("ribbon 2/1/2 morph has continuous geometry at every boundary and wrap", () => {
  assert.deepEqual(FIELD_CYCLE, { gather: 2000, hold: 1000, release: 2000 });
  assert.equal(RIBBON_STUDIES.length, 4);
  for (const start of [0, 5000, 10000, 15000])
    for (const boundary of [start + 2000, start + 3000, start + 5000])
      for (const index of [0, 1, 2])
        for (const t of [0.1, 0.3, 0.6, 0.9]) {
          const before = ribbonCenter(t, index, {
            ...scene,
            elapsed: boundary - 0.001,
          });
          const after = ribbonCenter(t, index, {
            ...scene,
            elapsed: boundary + 0.001,
          });
          assert.ok(
            Math.hypot(before.x - after.x, before.y - after.y) < 0.001,
            String(boundary),
          );
        }
  for (const elapsed of [NaN, Infinity, -1])
    assert.deepEqual(fieldBlend(elapsed), fieldBlend(0));
  assert.equal(fieldBlend(1500).phase, "gather");
  assert.equal(fieldBlend(2500).phase, "hold");
  assert.equal(fieldBlend(4500).phase, "release");
});

test("portrait ribbons span the whole screen vertically, with bounded width and smooth tangents", () => {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1920, 1080],
  ])
    for (const index of [0, 1, 2]) {
      const input = { ...scene, width, height };
      const samples = ribbonSamples(index, input);
      assert.deepEqual(samples, ribbonSamples(index, input));
      assert.ok(samples[0].y < 0 && samples.at(-1)!.y > height);
      for (let i = 0; i < samples.length; i++) {
        const p = samples[i];
        assert.ok(Object.values(p).every(Number.isFinite));
        assert.ok(Math.abs(Math.hypot(p.nx, p.ny) - 1) < 1e-9);
        assert.ok(p.radius > 0 && p.radius < width * 0.14);
        if (i) assert.ok(p.y > samples[i - 1].y, "scanlines remain ordered");
      }
    }
  assert.equal(ribbonSamples(0, scene, -1).length, 17);
  assert.equal(ribbonSamples(0, scene, Infinity).length, 97);
  assert.equal(ribbonSamples(0, scene, 1000).length, 161);
});

test("actual title envelope, reading position and nearby pointer affect the ribbon locally", () => {
  const p = ribbonCenter(0.5, 0, scene);
  const unlinked = ribbonCenter(0.5, 0, {
    ...scene,
    heading: { ...scene.heading, strength: 0 },
  });
  assert.ok(Math.abs(p.x - unlinked.x) > 1);
  const moved = ribbonCenter(0.5, 0, {
    ...scene,
    heading: { ...scene.heading, x: 600 },
  });
  assert.ok(Math.abs(p.x - moved.x) > 1);
  const scrolled = ribbonCenter(0.5, 0, { ...scene, scroll: 500 });
  assert.ok(Math.abs(p.x - scrolled.x) > 1);
  const pulled = ribbonCenter(0.5, 0, {
    ...scene,
    pointer: { x: p.x + 60, y: p.y + 20, active: 1 },
  });
  assert.ok(pulled.x > p.x && pulled.x - p.x < 10);
  assert.deepEqual(
    ribbonCenter(0.5, 0, {
      ...scene,
      pointer: { x: -10000, y: -10000, active: 1 },
    }),
    p,
  );
});

test("letters form one measured reading envelope, and shading feathers to transparent edges", () => {
  assert.deepEqual(glyphEnvelope([], scene.heading), scene.heading);
  assert.deepEqual(
    glyphEnvelope(
      [
        { x: 20, y: 30, radius: 10 },
        { x: 60, y: 30, radius: 10 },
      ],
      scene.heading,
    ),
    { x: 40, y: 30, width: 60, height: 20, strength: 1 },
  );
  for (const index of [0, 1, 2]) {
    assert.match(ribbonPigment(index, -1), /,0\.0000\)/);
    assert.match(ribbonPigment(index, 1), /,0\.0000\)/);
    assert.notEqual(ribbonPigment(index, -0.25), ribbonPigment(index, 0.25));
  }
});

test("only text leaves reconstruct at startup and public surfaces do not sample the live backdrop", async () => {
  const css = await fs.readFile("src/app/globals.css", "utf8");
  const selector =
    css.match(
      /\.home-page\[data-type-reveal="running"\]\s+:is\(([^}]+)\)\s*\{/,
    )?.[1] || "";
  assert.doesNotMatch(
    selector,
    /\.main-nav|\.menu-toggle|\.writing-toolbar|\.focus-item,|\.hero-bio,/,
  );
  assert.match(selector, /\.hero-bio > p/);
  for (const file of ["src/app/home.css", "src/app/travel/canvas.css"]) {
    const surface = await fs.readFile(file, "utf8");
    assert.doesNotMatch(surface, /backdrop-filter:\s*blur/);
  }
});
