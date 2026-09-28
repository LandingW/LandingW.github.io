export interface FractalBranch {
  id: number;
  parent: number | null;
  depth: number;
  path: string;
  delay: number;
  duration: number;
  width: number;
  opacity: number;
  accent: boolean;
}

export const FRACTAL_TIMING = { grow: 2000, hold: 1000, fade: 2000 } as const;
export interface FractalVariant {
  id: string;
  strokes: FractalBranch[];
}
type Point = [number, number];

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
    delay: depth,
    duration: 1,
    width: Math.max(0.75, 1.6 - depth * 0.14),
    opacity: 0.23 - depth * 0.015,
    accent: depth > 3 && id % 17 === 0,
  };
}

function polygon(points: Point[]): string {
  return `M${points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("L")}Z`;
}

function sierpinski(): FractalBranch[] {
  const a: Point = [720, -70],
    b: Point = [30, 870],
    c: Point = [1410, 870];
  const strokes = [stroke(polygon([a, b, c]), 0)];
  const midpoint = (p: Point, q: Point): Point => [
    (p[0] + q[0]) / 2,
    (p[1] + q[1]) / 2,
  ];
  function divide(p: Point, q: Point, r: Point, depth: number, parent: number) {
    if (depth > 5) return;
    const pq = midpoint(p, q),
      qr = midpoint(q, r),
      rp = midpoint(r, p);
    const id = strokes.length;
    strokes.push(stroke(polygon([pq, qr, rp]), id, depth, parent));
    divide(p, pq, rp, depth + 1, id);
    divide(pq, q, qr, depth + 1, id);
    divide(rp, qr, r, depth + 1, id);
  }
  divide(a, b, c, 1, 0);
  return strokes;
}

function kochSnowflakes(): FractalBranch[] {
  return [440, 285, 145].map((radius, index) => {
    const points: Point[] = [];
    const corners: Point[] = [-Math.PI / 2, (Math.PI * 5) / 6, Math.PI / 6].map(
      (angle) => [
        720 + Math.cos(angle) * radius,
        350 + Math.sin(angle) * radius,
      ],
    );
    function edge(a: Point, b: Point, level: number) {
      if (level === 0) {
        points.push(a);
        return;
      }
      const dx = (b[0] - a[0]) / 3,
        dy = (b[1] - a[1]) / 3;
      const p: Point = [a[0] + dx, a[1] + dy],
        q: Point = [a[0] + 2 * dx, a[1] + 2 * dy];
      const peak: Point = [
        p[0] + dx * 0.5 - (dy * Math.sqrt(3)) / 2,
        p[1] + (dx * Math.sqrt(3)) / 2 + dy * 0.5,
      ];
      edge(a, p, level - 1);
      edge(p, peak, level - 1);
      edge(peak, q, level - 1);
      edge(q, b, level - 1);
    }
    for (let i = 0; i < 3; i++)
      edge(corners[i], corners[(i + 1) % 3], 4 - Math.min(index, 2));
    return stroke(polygon(points), index, index);
  });
}

function dragonCurve(): FractalBranch[] {
  let turns: number[] = [];
  for (let i = 0; i < 10; i++)
    turns = [
      ...turns,
      1,
      ...turns
        .slice()
        .reverse()
        .map((turn) => -turn),
    ];
  const points: Point[] = [
    [0, 0],
    [1, 0],
  ];
  const directions: Point[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  let direction = 0;
  for (const turn of turns) {
    direction = (direction + turn + 4) % 4;
    const last = points[points.length - 1],
      delta = directions[direction];
    points.push([last[0] + delta[0], last[1] + delta[1]]);
  }
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(1250 / (maxX - minX), 660 / (maxY - minY));
  const mapped = points.map((p): Point => [
    720 + (p[0] - (minX + maxX) / 2) * scale,
    380 + (p[1] - (minY + maxY) / 2) * scale,
  ]);
  return [
    stroke(
      `M${mapped.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("L")}`,
      0,
    ),
  ];
}

export function buildFractalVariants(): FractalVariant[] {
  return [
    { id: "branching", strokes: buildFractalBranches() },
    { id: "sierpinski", strokes: sierpinski() },
    { id: "koch", strokes: kochSnowflakes() },
    { id: "dragon", strokes: dragonCurve() },
  ];
}

export function growthSchedule(strokes: FractalBranch[]) {
  if (!strokes.length) return [];
  const beginning = Math.min(...strokes.map((item) => item.delay));
  const span =
    Math.max(...strokes.map((item) => item.delay + item.duration)) - beginning;
  return strokes.map((item) => ({
    delay: ((item.delay - beginning) / span) * FRACTAL_TIMING.grow,
    duration: (item.duration / span) * FRACTAL_TIMING.grow,
  }));
}

/** Two self-similar binary trees, mirrored into the edges of the poster. */
export function buildFractalBranches(requestedDepth = 6): FractalBranch[] {
  const maxDepth = Number.isFinite(requestedDepth)
    ? Math.max(0, Math.min(7, Math.floor(requestedDepth)))
    : 6;
  const branches: FractalBranch[] = [];
  function branch(
    x: number,
    y: number,
    angle: number,
    length: number,
    depth: number,
    parent: number | null,
    delay: number,
    handedness: number,
  ) {
    const id = branches.length;
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    const bend = length * 0.065 * handedness;
    const controlX = (x + endX) / 2 - Math.sin(angle) * bend;
    const controlY = (y + endY) / 2 + Math.cos(angle) * bend;
    const duration = Math.round(900 * 0.88 ** depth);
    branches.push({
      id,
      parent,
      depth,
      path: `M${x.toFixed(2)},${y.toFixed(2)}Q${controlX.toFixed(2)},${controlY.toFixed(2)} ${endX.toFixed(2)},${endY.toFixed(2)}`,
      delay,
      duration,
      width: 1.7 - depth * 0.15,
      opacity: 0.26 - depth * 0.015,
      accent: depth === maxDepth && id % 11 === 0,
    });
    if (depth === maxDepth) return;
    const nextStart = delay + duration;
    branch(
      endX,
      endY,
      angle - handedness * 0.48,
      length * 0.73,
      depth + 1,
      id,
      nextStart + 24 + (id % 43),
      handedness,
    );
    branch(
      endX,
      endY,
      angle + handedness * 0.62,
      length * 0.71,
      depth + 1,
      id,
      nextStart + 48 + (id % 61),
      handedness,
    );
  }
  branch(-70, 730, -0.86, 286, 0, null, 180, 1);
  branch(1510, 790, -2.28, 290, 0, null, 470, -1);
  return branches;
}
