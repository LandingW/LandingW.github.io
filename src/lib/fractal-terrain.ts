/** A continuous domain-warped fBm field, drawn as a small family of contours.
 * The mathematics is sampled in world space: no motifs, mirrors or image tiles.
 * Inspired by the composition principles in Tyler Hobbs' Flow Fields and the
 * domain-warping technique explained by Inigo Quilez; implementation is original.
 */
export type Point = readonly [number, number];
export const TERRAIN_STUDIES = [
  "alluvial",
  "dunes",
  "islands",
  "folds",
] as const;
export type TerrainStudy = (typeof TERRAIN_STUDIES)[number];
export interface TerrainContour {
  id: number;
  path: string;
  level: number;
  closed: boolean;
  length: number;
  tone: "sage" | "silt" | "slate";
  weight: number;
  opacity: number;
}
export interface TerrainVariant {
  id: TerrainStudy;
  contours: TerrainContour[];
}

function hash(x: number, y: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function gradient(h: number, x: number, y: number) {
  const a = h & 7;
  return a < 4
    ? ((a & 1 ? -x : x) + (a & 2 ? -y : y)) * 0.70710678
    : a === 4
      ? x
      : a === 5
        ? -x
        : a === 6
          ? y
          : -y;
}
export function terrainNoise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    u = x - ix,
    v = y - iy;
  return mix(
    mix(
      gradient(hash(ix, iy), u, v),
      gradient(hash(ix + 1, iy), u - 1, v),
      fade(u),
    ),
    mix(
      gradient(hash(ix, iy + 1), u, v - 1),
      gradient(hash(ix + 1, iy + 1), u - 1, v - 1),
      fade(u),
    ),
    fade(v),
  );
}
export function terrainFbm(x: number, y: number, octaves = 4) {
  let value = 0,
    amplitude = 0.6;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * terrainNoise(x, y);
    // Rotation prevents successive octaves from exposing the sampling lattice.
    [x, y] = [1.62 * x - 1.18 * y + 7.1, 1.18 * x + 1.62 * y + 3.4];
    amplitude *= 0.43;
  }
  return value;
}

export function terrainValue(x: number, y: number, study: TerrainStudy) {
  const phase = TERRAIN_STUDIES.indexOf(study) * 7.31;
  const qx = terrainFbm(x * 0.66 + 2.3 + phase, y * 0.66 + 1.4, 3);
  const qy = terrainFbm(x * 0.66 + 8.7, y * 0.66 + 9.2 + phase, 3);
  const u = x + qx * 1.55,
    v = y + qy * 1.55;
  const detail = terrainFbm(u + phase, v + 2.7);
  if (study === "alluvial")
    return 0.31 * Math.sin(u * 1.35 + v * 0.68 + 0.65) + detail * 0.8;
  if (study === "dunes")
    return 0.34 * Math.sin(u * 0.8 - v * 1.7 + qx * 2.4) + detail * 0.5;
  if (study === "islands") return detail + 0.16 * Math.cos(u * 1.1 + v * 0.5);
  return (
    0.29 * Math.sin(v * 1.15 + Math.sin(u * 1.3) * 1.6 + qy * 2) + detail * 0.68
  );
}

type Vertex = { point: Point; neighbors: string[] };

/** Marching squares with shared grid-edge identities. Interior endpoints cannot
 * dangle: adjacent cells literally share the same vertex, including saddles. */
export function traceContours(
  samples: Float64Array,
  columns: number,
  rows: number,
  step: number,
  origin: Point,
  level: number,
): { points: Point[]; closed: boolean }[] {
  const vertices = new Map<string, Vertex>();
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const index = row * columns + col;
      const code =
        (samples[index] > level ? 1 : 0) |
        (samples[index + 1] > level ? 2 : 0) |
        (samples[index + columns + 1] > level ? 4 : 0) |
        (samples[index + columns] > level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const values = [
        samples[index],
        samples[index + 1],
        samples[index + columns + 1],
        samples[index + columns],
      ];
      const coords: Point[] = [
        [col, row],
        [col + 1, row],
        [col + 1, row + 1],
        [col, row + 1],
      ];
      const keys = [
        `h${col},${row}`,
        `v${col + 1},${row}`,
        `h${col},${row + 1}`,
        `v${col},${row}`,
      ];
      const edges: number[] = [];
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4;
        if (values[edge] > level === values[next] > level) continue;
        edges.push(edge);
        if (!vertices.has(keys[edge])) {
          const t = (level - values[edge]) / (values[next] - values[edge]);
          vertices.set(keys[edge], {
            point: [
              origin[0] + mix(coords[edge][0], coords[next][0], t) * step,
              origin[1] + mix(coords[edge][1], coords[next][1], t) * step,
            ],
            neighbors: [],
          });
        }
      }
      const connect = (a: number, b: number) => {
        vertices.get(keys[a])!.neighbors.push(keys[b]);
        vertices.get(keys[b])!.neighbors.push(keys[a]);
      };
      if (edges.length === 2) connect(edges[0], edges[1]);
      if (edges.length === 4) {
        const determinant =
          (values[0] - level) * (values[2] - level) -
          (values[1] - level) * (values[3] - level);
        if (determinant >= 0) {
          connect(0, 1);
          connect(2, 3);
        } else {
          connect(0, 3);
          connect(1, 2);
        }
      }
    }
  }
  const visited = new Set<string>();
  const result: { points: Point[]; closed: boolean }[] = [];
  // Open paths must be traced from a boundary, then trace remaining closed loops.
  const entries = [...vertices.entries()].sort(
    (a, b) => a[1].neighbors.length - b[1].neighbors.length,
  );
  for (const [start] of entries) {
    if (visited.has(start)) continue;
    const points: Point[] = [];
    let current: string | undefined = start,
      closed = false;
    while (current && !visited.has(current)) {
      visited.add(current);
      const vertex: Vertex = vertices.get(current)!;
      points.push(vertex.point);
      const next: string | undefined = vertex.neighbors.find(
        (key) => !visited.has(key),
      );
      if (!next) closed = points.length > 2 && vertex.neighbors.includes(start);
      current = next;
    }
    if (points.length > 2) result.push({ points, closed });
  }
  return result;
}

function pathLength(points: Point[], closed: boolean) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
    );
  if (closed)
    length += Math.hypot(
      points[0][0] - points.at(-1)![0],
      points[0][1] - points.at(-1)![1],
    );
  return length;
}

function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const a = points[0],
    b = points.at(-1)!;
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    norm = dx * dx + dy * dy;
  let furthest = 0,
    distance = tolerance * tolerance;
  for (let i = 1; i < points.length - 1; i++) {
    const t = norm
      ? Math.max(
          0,
          Math.min(
            1,
            ((points[i][0] - a[0]) * dx + (points[i][1] - a[1]) * dy) / norm,
          ),
        )
      : 0;
    const d =
      (points[i][0] - a[0] - t * dx) ** 2 + (points[i][1] - a[1] - t * dy) ** 2;
    if (d > distance) {
      distance = d;
      furthest = i;
    }
  }
  return furthest
    ? [
        ...simplify(points.slice(0, furthest + 1), tolerance).slice(0, -1),
        ...simplify(points.slice(furthest), tolerance),
      ]
    : [a, b];
}

function smoothPath(source: Point[], closed: boolean) {
  const points = simplify(source, 0.7);
  const fmt = (p: Point) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const mid = (a: Point, b: Point): Point => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  let path = `M${fmt(closed ? mid(points.at(-1)!, points[0]) : points[0])}`;
  for (let i = closed ? 0 : 1; i < points.length - 1; i++)
    path += `Q${fmt(points[i])} ${fmt(mid(points[i], points[i + 1]))}`;
  return closed
    ? `${path}Q${fmt(points.at(-1)!)} ${fmt(mid(points.at(-1)!, points[0]))}Z`
    : `${path}L${fmt(points.at(-1)!)}`;
}

export function buildTerrain(
  study: TerrainStudy,
  width: number,
  height: number,
  portrait: boolean,
): TerrainVariant {
  const step = portrait ? 8 : 14;
  const scale = portrait ? 235 : 510;
  const origin: Point = [-step * 4, -step * 4];
  const columns = Math.ceil(width / step) + 9,
    rows = Math.ceil(height / step) + 9;
  const values = new Float64Array(columns * rows);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++)
      values[row * columns + col] = terrainValue(
        (origin[0] + col * step) / scale,
        (origin[1] + row * step) / scale,
        study,
      );
  const contours: TerrainContour[] = [];
  // Wide-spaced minor contours; only every fourth is an index contour. Avoid
  // the dense, equally dark hairlines that compete with the foreground type.
  for (let index = 0; index < 19; index++) {
    const level = -0.54 + index * 0.06;
    for (const contour of traceContours(
      values,
      columns,
      rows,
      step,
      origin,
      level,
    )) {
      const length = pathLength(contour.points, contour.closed);
      if (length < (portrait ? 46 : 100)) continue;
      contours.push({
        id: contours.length,
        path: smoothPath(contour.points, contour.closed),
        level: index,
        closed: contour.closed,
        length,
        tone: index < 7 ? "silt" : index > 12 ? "slate" : "sage",
        weight: index % 4 === 0 ? 1.35 : 0.7,
        opacity: index % 4 === 0 ? 0.34 : 0.19,
      });
    }
  }
  return { id: study, contours };
}
