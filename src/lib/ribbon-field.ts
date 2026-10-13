/** Broad, continuous ribbons. Geometry morphs; the paper/foreground never fades. */
export const RIBBON_STUDIES = ["arc", "drift", "fold", "unfurl"] as const;
export const FIELD_CYCLE = { gather: 2000, hold: 1000, release: 2000 } as const;
export type Point = { x: number; y: number };
export type GlyphAnchor = Point & { radius: number };
export type ReadingAnchor = Point & {
  width: number;
  height: number;
  strength: number;
};
export type RibbonInput = {
  width: number;
  height: number;
  elapsed: number;
  scroll: number;
  heading: ReadingAnchor;
  pointer: Point & { active: number };
};
export type RibbonSample = Point & { nx: number; ny: number; radius: number };
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const ease = (v: number) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function fieldBlend(elapsed: number) {
  const time = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  const cycle = FIELD_CYCLE.gather + FIELD_CYCLE.hold + FIELD_CYCLE.release;
  const index = Math.floor(time / cycle) % RIBBON_STUDIES.length,
    local = time % cycle;
  if (local < FIELD_CYCLE.gather)
    return {
      from: (index + RIBBON_STUDIES.length - 1) % RIBBON_STUDIES.length,
      to: index,
      mix: 0.5 + 0.5 * ease(local / FIELD_CYCLE.gather),
      phase: "gather",
    };
  if (local < FIELD_CYCLE.gather + FIELD_CYCLE.hold)
    return { from: index, to: index, mix: 0, phase: "hold" };
  return {
    from: index,
    to: (index + 1) % RIBBON_STUDIES.length,
    mix:
      0.5 *
      ease(
        (local - FIELD_CYCLE.gather - FIELD_CYCLE.hold) / FIELD_CYCLE.release,
      ),
    phase: "release",
  };
}

/** Four related compositions, not four disconnected drawings. */
const SHAPES = [
  { bend: 0.2, phase: -0.55, fold: 0.28 },
  { bend: 0.27, phase: 0.1, fold: 0.48 },
  { bend: 0.18, phase: 0.65, fold: -0.22 },
  { bend: 0.24, phase: -0.15, fold: -0.4 },
];

export function ribbonCenter(
  t: number,
  index: number,
  input: RibbonInput,
): Point {
  const { width: w, height: h, heading, pointer } = input;
  const portrait = h > w;
  const blend = fieldBlend(input.elapsed);
  const a = SHAPES[blend.from],
    b = SHAPES[blend.to];
  const bend = lerp(a.bend, b.bend, blend.mix);
  const phase = lerp(a.phase, b.phase, blend.mix);
  const fold = lerp(a.fold, b.fold, blend.mix);
  // Portrait uses the entire vertical axis, not a cropped landscape drawing.
  const y = h * (-0.22 + 1.44 * t);
  const reading = Math.sin((input.scroll / Math.max(h, 1)) * 0.65) * 0.22;
  const angle =
    t * TAU * (portrait ? 0.82 : 0.68) + phase + index * 1.85 + reading;
  const mid = [0.12, 0.86, 0.53][index];
  const amplitude = index === 2 ? 0.35 : bend;
  // Small nested frequencies add a natural edge without contour lines/noise.
  const detail =
    Math.sin(angle * 2.0 + fold) * 0.018 + Math.sin(angle * 4.0 - fold) * 0.003;
  let x = w * (mid + amplitude * Math.sin(angle) + detail);
  const nearHeading = Math.exp(
    -(((y - heading.y) / Math.max(h * 0.18, heading.height * 0.8)) ** 2),
  );
  const side = index === 0 ? -1 : 1;
  const orbit =
    heading.x + side * (heading.width * 0.5 + w * (portrait ? 0.08 : 0.065));
  // The actual title envelope gently bends the ribbon away from the reading area.
  if (index < 2)
    x +=
      clamp(orbit - x, -w * 0.18, w * 0.18) *
      nearHeading *
      heading.strength *
      0.72;
  const dx = pointer.x - x,
    dy = pointer.y - y;
  const reach = Math.max(150, Math.min(w, h) * 0.42);
  const pull =
    Math.exp(-(dx * dx + dy * dy) / (reach * reach)) * pointer.active * 0.12;
  return { x: x + clamp(dx, -80, 80) * pull, y: y + clamp(dy, -80, 80) * pull };
}

export function ribbonSamples(
  index: number,
  input: RibbonInput,
  count = 96,
): RibbonSample[] {
  const n = Number.isFinite(count) ? clamp(Math.floor(count), 16, 160) : 96;
  const portrait = input.height > input.width;
  const span = Math.min(
    input.width * (portrait ? 0.13 : 0.085),
    portrait ? 66 : 140,
  );
  const points = Array.from({ length: n + 1 }, (_, i) =>
    ribbonCenter(i / n, index, input),
  );
  return points.map((p, i) => {
    const before = points[Math.max(0, i - 1)],
      after = points[Math.min(n, i + 1)];
    const dx = after.x - before.x,
      dy = after.y - before.y,
      length = Math.hypot(dx, dy) || 1;
    const twist =
      0.72 +
      0.25 *
        Math.sin((i / n) * TAU * 0.8 + index * 1.5 + input.scroll * 0.00015);
    return {
      ...p,
      nx: dy / length,
      ny: -dx / length,
      radius: span * twist * (index === 2 ? 0.68 : 1),
    };
  });
}

/** A satin-like cross section: feathered edge, soft body, narrow light fold. */
export function ribbonPigment(index: number, across: number) {
  const colors = [
    [93, 134, 119],
    [113, 142, 151],
    [180, 148, 99],
  ];
  const light = 0.16 + 0.76 * Math.exp(-(((across + 0.24) / 0.24) ** 2));
  const rgb = colors[index].map((v) => Math.round(lerp(v, 249, light)));
  const feather = 1 - ease((Math.abs(across) - 0.6) / 0.4);
  const alpha = feather * (index === 2 ? 0.2 : 0.34);
  return `rgba(${rgb.join(",")},${alpha.toFixed(4)})`;
}

/** Real per-letter measurements form one calm envelope, never flying letter particles. */
export function glyphEnvelope(
  glyphs: GlyphAnchor[],
  fallback: ReadingAnchor,
): ReadingAnchor {
  if (!glyphs.length) return fallback;
  const left = Math.min(...glyphs.map((g) => g.x - g.radius));
  const right = Math.max(...glyphs.map((g) => g.x + g.radius));
  const top = Math.min(...glyphs.map((g) => g.y - g.radius));
  const bottom = Math.max(...glyphs.map((g) => g.y + g.radius));
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
    strength: fallback.strength,
  };
}
