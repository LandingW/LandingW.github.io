import source from "./generated/julia-study.json";

export type ArtPoint = [number, number];
export type ArtFormat = "landscape" | "portrait";
export type JuliaData = { bands: { level: number; loops: number[][][] }[] };
export type JuliaBand = { loops: ArtPoint[][]; fill: number; stroke: number };
export type JuliaPlate = { ink: string; bands: JuliaBand[] };
export const JULIA_VIEWBOX = {
  landscape: [1440, 1000],
  portrait: [420, 900],
} as const;

/** Affine framing of actual z²+c escape contours, never fBm or fabricated swirls. */
export function buildJuliaPlates(
  format: ArtFormat,
  data: JuliaData = source,
): JuliaPlate[] {
  const frames =
    format === "portrait"
      ? [
          { x: 64, y: 445, size: 0.94, angle: 1.23 },
          { x: 375, y: 765, size: 0.65, angle: -0.9 },
        ]
      : [
          { x: 360, y: 165, size: 1.4, angle: -0.33 },
          { x: 1270, y: 630, size: 1.5, angle: -1.13 },
        ];
  return frames.map((frame, i) => ({
    ink: i ? "#ad8157" : "#527f76",
    bands: (i ? data.bands.slice(0, 2) : data.bands).map((band, depth) => ({
      fill: i ? 0.035 + depth * 0.03 : 0.035 + depth * 0.032,
      stroke: i ? 0.19 + depth * 0.1 : 0.23 + depth * 0.11,
      loops: band.loops.map((loop) =>
        loop.map(([x, y]): ArtPoint => {
          const u = (x - 500) * frame.size,
            v = (y - 500) * frame.size;
          return [
            frame.x + u * Math.cos(frame.angle) - v * Math.sin(frame.angle),
            frame.y + u * Math.sin(frame.angle) + v * Math.cos(frame.angle),
          ];
        }),
      ),
    })),
  }));
}

/** Quadratic contour reconstruction keeps precomputed detail smooth at every scale. */
export function juliaPath(
  loops: ArtPoint[][],
  deform: (p: ArtPoint) => ArtPoint = (p) => p,
) {
  const f = (p: ArtPoint) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const mid = (a: ArtPoint, b: ArtPoint): ArtPoint => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  return loops
    .map((loop) => {
      const points = loop.map(deform);
      let d = `M${f(mid(points.at(-1)!, points[0]))}`;
      for (let i = 0; i < points.length; i++)
        d += `Q${f(points[i])} ${f(mid(points[i], points[(i + 1) % points.length]))}`;
      return d + "Z";
    })
    .join("");
}

export type ArtSurface = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

/** Rounded-box distance field. Only a narrow margin bends; deep interiors are
 * covered by opaque paper. Opposing margins cancel instead of accumulating spikes.
 */
export function bendJuliaPoint(
  point: ArtPoint,
  surfaces: ArtSurface[],
  reach = 84,
): ArtPoint {
  let vx = 0,
    vy = 0,
    weights = 0;
  for (const box of surfaces) {
    const margin = Math.min(reach, Math.min(box.width, box.height) * 0.22);
    if (margin <= 0) continue;
    const px = point[0] - box.x - box.width / 2,
      py = point[1] - box.y - box.height / 2;
    const r = Math.min(box.radius, box.width / 2, box.height / 2);
    const qx = Math.abs(px) - box.width / 2 + r,
      qy = Math.abs(py) - box.height / 2 + r;
    if (qx > margin + r || qy > margin + r) continue;
    const ox = Math.max(qx, 0),
      oy = Math.max(qy, 0),
      length = Math.hypot(ox, oy);
    const distance = length + Math.min(Math.max(qx, qy), 0) - r;
    if (Math.abs(distance) >= margin) continue;
    const weight = (1 - (distance / margin) ** 2) ** 2;
    const nx = length ? ox / length : qx > qy ? 1 : 0;
    const ny = length ? oy / length : qx > qy ? 0 : 1;
    vx += (Math.sign(px) * nx * weight * margin) / reach;
    vy += (Math.sign(py) * ny * weight * margin) / reach;
    weights += weight;
  }
  const strength = (reach * 0.38) / Math.max(1, weights);
  return [point[0] + vx * strength, point[1] + vy * strength];
}
