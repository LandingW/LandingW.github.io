import type { FractalBranch, FractalVariant } from "./fractal-growth";

export const PORTRAIT_WIDTH = 420;
export const PORTRAIT_SPAN = 840;
export const PORTRAIT_SCROLL_RATE = 0.28;
type Point = [number, number];

// Size a single world-space field to the document, including the entire scroll
// camera range. It never wraps at a tile boundary.
export function portraitRows(
  width: number,
  viewport: number,
  document: number,
) {
  if (![width, viewport, document].every(Number.isFinite) || width <= 0)
    return 2;
  return Math.max(
    2,
    Math.ceil(
      (viewport +
        Math.max(0, document - viewport) * PORTRAIT_SCROLL_RATE +
        240) /
        (width / PORTRAIT_WIDTH) /
        PORTRAIT_SPAN,
    ),
  );
}

function line(points: Point[], close = false) {
  return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}${close ? "Z" : ""}`;
}
function stroke(
  path: string,
  id: number,
  depth = 0,
  parent: number | null = null,
): FractalBranch {
  return {
    id,
    parent,
    depth,
    path,
    delay: depth * 0.65,
    duration: 0.6,
    width: Math.max(0.6, 2.7 - depth * 0.6),
    opacity: 0.46 - depth * 0.055,
    accent: false,
    continuous: depth === 0,
  };
}

function fern(height: number) {
  const center = (y: number) =>
    210 + 16 * Math.sin((y * Math.PI * 2) / PORTRAIT_SPAN);
  const spine: Point[] = [];
  for (let y = -120; y <= height + 120; y += 20) spine.push([center(y), y]);
  const paths = [stroke(line(spine), 0)];
  function branch(
    p: Point,
    angle: number,
    length: number,
    depth: number,
    parent: number,
    accent: boolean,
  ) {
    const end: Point = [
      p[0] + Math.cos(angle) * length,
      p[1] + Math.sin(angle) * length,
    ];
    const id = paths.length;
    paths.push({ ...stroke(line([p, end]), id, depth, parent), accent });
    if (depth === 4) return;
    branch(end, angle - 0.38, length * 0.61, depth + 1, id, accent);
    branch(end, angle + 0.38, length * 0.61, depth + 1, id, accent);
  }
  for (let y = 80, i = 0; y < height + 120; y += 150, i++) {
    const side = i % 2 ? -1 : 1;
    branch([center(y), y], -Math.PI / 2 + side * 0.85, 90, 1, 0, side < 0);
  }
  return paths;
}

function triangularLattice(height: number) {
  const triangles: [Point, Point, Point][] = [];
  const outline: Point[] = [[210, -280]];
  for (let y = -280, i = 0; y < height + 280; y += 280, i++) {
    const a: Point = [210, y],
      b: Point = [i % 2 ? 382 : 38, y + 140],
      c: Point = [210, y + 280];
    triangles.push([a, b, c]);
    outline.push(b, c);
  }
  const paths = [stroke(line(outline, true), 0)];
  const mid = (a: Point, b: Point): Point => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  function divide(a: Point, b: Point, c: Point, depth: number, parent: number) {
    if (depth > 3) return;
    const ab = mid(a, b),
      bc = mid(b, c),
      ca = mid(c, a),
      id = paths.length;
    paths.push({
      ...stroke(line([ab, bc, ca], true), id, depth, parent),
      accent: depth === 2,
    });
    divide(a, ab, ca, depth + 1, id);
    divide(ab, b, bc, depth + 1, id);
    divide(ca, bc, c, depth + 1, id);
  }
  for (const triangle of triangles) divide(...triangle, 1, 0);
  return paths;
}

function kochCoast(height: number) {
  const points: Point[] = [];
  function edge(a: Point, b: Point, depth: number, side: number) {
    if (!depth) {
      points.push(a);
      return;
    }
    const dx = (b[0] - a[0]) / 3,
      dy = (b[1] - a[1]) / 3;
    const p: Point = [a[0] + dx, a[1] + dy],
      q: Point = [a[0] + dx * 2, a[1] + dy * 2];
    const peak: Point = [
      p[0] + dx / 2 - (side * dy * Math.sqrt(3)) / 2,
      p[1] + dy / 2 + (side * dx * Math.sqrt(3)) / 2,
    ];
    edge(a, p, depth - 1, side);
    edge(p, peak, depth - 1, side);
    edge(peak, q, depth - 1, side);
    edge(q, b, depth - 1, side);
  }
  for (let y = -840; y < height + 840; y += 840) {
    const corners: Point[] = [
      [210, y],
      [110, y + 210],
      [210, y + 420],
      [310, y + 630],
      [210, y + 840],
    ];
    for (let i = 0; i < 4; i++)
      edge(corners[i], corners[i + 1], 3, i < 2 ? 1 : -1);
  }
  points.push([210, height + 840]);
  return [stroke(line(points), 0)];
}

function dragonRibbon(height: number) {
  let turns: number[] = [];
  for (let i = 0; i < 7; i++)
    turns = [
      ...turns,
      1,
      ...turns
        .slice()
        .reverse()
        .map((t) => -t),
    ];
  const base: Point[] = [
      [0, 0],
      [1, 0],
    ],
    directions: Point[] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
  let direction = 0;
  for (const turn of turns) {
    direction = (direction + turn + 4) % 4;
    const p = base[base.length - 1],
      d = directions[direction];
    base.push([p[0] + d[0], p[1] + d[1]]);
  }
  const [dx, dy] = base[base.length - 1],
    distance2 = dx * dx + dy * dy,
    step = 252;
  const points: Point[] = [];
  for (let y = -step, i = 0; y < height + step; y += step, i++) {
    const side = i % 2 ? -1 : 1;
    base.forEach(([x, v], index) => {
      if (index === 0 && points.length) return;
      // Rigid rotation + uniform scale, not a stretched landscape dragon.
      points.push([
        210 + (side * (x * dy - v * dx) * step) / distance2,
        y + ((x * dx + v * dy) * step) / distance2,
      ]);
    });
  }
  return [{ ...stroke(line(points), 0), width: 2.2, accent: true }];
}

export function buildPortraitFractals(requestedRows = 2): FractalVariant[] {
  const rows = Number.isFinite(requestedRows)
    ? Math.max(2, Math.floor(requestedRows))
    : 2;
  const height = rows * PORTRAIT_SPAN;
  return [
    { id: "branching", strokes: fern(height) },
    { id: "sierpinski", strokes: triangularLattice(height) },
    { id: "koch", strokes: kochCoast(height) },
    { id: "dragon", strokes: dragonRibbon(height) },
  ];
}
