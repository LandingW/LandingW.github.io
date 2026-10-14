/** Build-time raster for the selected travel study. Never imported by the UI. */
export type SandFormat = "landscape" | "portrait";
type SandForm = readonly [number, number, number, number, number];

export const SAND_SEED = 2887;
export const SAND_PARTICLES = 76000;
export const SAND_COLORS = [
  [82, 123, 119],
  [132, 155, 136],
  [183, 126, 102],
] as const;

// Independent compositions from the selected sample, not a cropped desktop image.
export const SAND_FORMS: Record<SandFormat, readonly SandForm[]> = {
  landscape: [
    [0.8, 0.29, 0.34, 0.24, -0.5],
    [0.27, 0.66, 0.4, 0.25, 0.2],
    [0.98, 0.9, 0.25, 0.24, -0.4],
  ],
  portrait: [
    [0.7, 0.2, 0.48, 0.16, -0.4],
    [0.42, 0.54, 0.59, 0.17, 0.1],
    [0.66, 0.89, 0.5, 0.14, -0.7],
  ],
};

function randomSequence(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function renderSand(width: number, height: number, format: SandFormat) {
  if (
    ![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 4096) ||
    !Object.hasOwn(SAND_FORMS, format)
  ) {
    throw new RangeError("Invalid sand raster dimensions or composition");
  }
  const accumulated = new Float32Array(width * height * 4);
  const random = randomSequence(SAND_SEED);
  const referenceArea = format === "portrait" ? 390 * 1280 : 1000 * 1210;
  const grainScale = Math.sqrt((width * height) / referenceArea);

  SAND_FORMS[format].forEach(([cx, cy, rx, ry, rotation], group) => {
    const cos = Math.cos(rotation),
      sin = Math.sin(rotation);
    for (let k = 0; k < SAND_PARTICLES; k++) {
      const t = random() * Math.PI * 2;
      const u = Math.pow(random(), 1.7);
      const ripple =
        0.027 * Math.sin(t * 5 + u * 7) + 0.009 * Math.sin(t * 13 + u * 6);
      const radius = 0.48 + u * 0.51 + ripple;
      const px =
        Math.cos(t) * rx * width * radius +
        Math.sin(t * 2 + u * 3) * rx * width * 0.22;
      const py = Math.sin(t) * ry * height * radius;
      const x = cx * width + px * cos - py * sin;
      const y = cy * height + px * sin + py * cos;
      const alpha = 0.2 + Math.pow(Math.sin(u * 30) * 0.5 + 0.5, 5) * 0.45;
      const size = (0.65 + random() * 0.85) * grainScale;
      const color = SAND_COLORS[(group + (u > 0.87 ? 1 : 0)) % 3];

      // Area coverage preserves subpixel grains without a blur pass. Accumulate
      // premultiplied color so intersecting green and terracotta curves mix cleanly.
      for (
        let iy = Math.max(0, Math.floor(y));
        iy < Math.min(height, Math.ceil(y + size));
        iy++
      ) {
        const dy = Math.min(iy + 1, y + size) - Math.max(iy, y);
        for (
          let ix = Math.max(0, Math.floor(x));
          ix < Math.min(width, Math.ceil(x + size));
          ix++
        ) {
          const dx = Math.min(ix + 1, x + size) - Math.max(ix, x);
          const a = alpha * dx * dy;
          const i = (iy * width + ix) * 4;
          for (let c = 0; c < 3; c++)
            accumulated[i + c] = color[c] * a + accumulated[i + c] * (1 - a);
          accumulated[i + 3] = a + accumulated[i + 3] * (1 - a);
        }
      }
    }
  });

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = accumulated[i + 3];
    if (!alpha) continue;
    for (let c = 0; c < 3; c++)
      rgba[i + c] = Math.round(accumulated[i + c] / alpha);
    rgba[i + 3] = Math.round(alpha * 255);
  }
  return rgba;
}
