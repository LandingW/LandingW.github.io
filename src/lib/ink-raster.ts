/** Build-time only: the selected ink study uses z² + (-0.4 + 0.6i). */
export const INK_C = [-0.4, 0.6] as const;
export const INK_RGB = [90, 104, 87] as const;
export type InkFormat = "landscape" | "portrait";

export function inkGrain(x: number, y: number) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function inkDensity(zx: number, zy: number, grain: number) {
  let dx = 1,
    dy = 0,
    n = 0,
    radius2 = zx * zx + zy * zy;
  for (; n < 150 && radius2 < 256; n++) {
    const nextDx = 2 * (zx * dx - zy * dy);
    dy = 2 * (zx * dy + zy * dx);
    dx = nextDx;
    const nextX = zx * zx - zy * zy + INK_C[0];
    zy = 2 * zx * zy + INK_C[1];
    zx = nextX;
    radius2 = zx * zx + zy * zy;
  }
  if (n === 150) return 0.22 + 0.1 * grain;
  const potential =
    n + 1 - Math.log2(Math.max(0.001, Math.log(Math.sqrt(radius2))));
  const distance =
    (0.5 * Math.sqrt(radius2) * Math.log(radius2)) /
    Math.max(1, Math.hypot(dx, dy));
  return (
    Math.pow(Math.max(0, Math.min(1, potential / 48)), 0.8) *
      0.52 *
      (0.43 + 0.57 * grain) +
    Math.exp(-distance * 32) * 0.12
  );
}

export function inkPixel(
  u: number,
  v: number,
  format: InkFormat,
  grain: number,
) {
  const portrait = format === "portrait";
  const angle = portrait ? 0.98 : -0.98;
  const ax = (u - (portrait ? 0.48 : 0.69)) * (portrait ? 2.7 : 3.7);
  const ay = (v - (portrait ? 0.64 : 0.43)) * (portrait ? 3.65 : 2.95);
  const zx = ax * Math.cos(angle) - ay * Math.sin(angle);
  const zy = ax * Math.sin(angle) + ay * Math.cos(angle);
  const main = inkDensity(zx, zy, grain);
  // A smaller impression reaches the opposite edge, not a repeated tile.
  const bx = (u - 0.025) * (portrait ? 5.0 : 5.8);
  const by = (v - (portrait ? 1.12 : 0.98)) * (portrait ? 5.3 : 4.8);
  const secondary =
    inkDensity(bx * 0.5 + by * 0.866, -bx * 0.866 + by * 0.5, grain) * 0.42;
  const feather = Math.exp(
    -Math.pow((u - 0.55) / 1.3, 8) - Math.pow((v - 0.64) / 1.35, 8),
  );
  return Math.min(0.65, (main + secondary * (1 - main)) * feather);
}

export function renderInk(width: number, height: number, format: InkFormat) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const alpha = inkPixel(
        (x / (width - 1)) * 1.12 - 0.06,
        (y / (height - 1)) * 1.4,
        format,
        inkGrain(x, y),
      );
      const i = (y * width + x) * 4;
      rgba.set(INK_RGB, i);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  return rgba;
}
