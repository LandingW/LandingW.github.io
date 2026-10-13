import type { FractalBranch, FractalVariant } from "./fractal-growth";

export const PORTRAIT_WIDTH = 420;
export const PORTRAIT_SPAN = 840;
export const PORTRAIT_SCROLL_RATE = 0.28;
type Point = [number, number];

// Two slow, incommensurate waves create a continuous drifting composition.
// Coordinates do not depend on document length, so extending the canvas cannot
// reposition existing geometry. The field opens up around changing focal areas.
export function portraitFlow(y: number) {
  return 210 + 62 * Math.sin(y / 247 + 0.8) + 22 * Math.sin(y / 431 + 1.4);
}

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
    width: Math.max(0.65, 2.3 - depth * 0.45),
    opacity: 0.43 - depth * 0.05,
    accent: false,
    continuous: depth === 0,
  };
}

function fern(height: number) {
  const spine: Point[] = [];
  for (let y = -160; y <= height + 160; y += 10)
    spine.push([portraitFlow(y), y]);
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
  for (let y = 40, i = 0; y < height + 160; i++) {
    const side = i % 2 ? -1 : 1;
    const x = portraitFlow(y);
    const room = side > 0 ? 402 - x : x - 18;
    const length = Math.min(90 + 12 * Math.sin(i * 1.7), room * 0.44);
    branch(
      [x, y],
      -Math.PI / 2 + side * (0.8 + 0.12 * Math.sin(i)),
      length,
      1,
      0,
      side < 0,
    );
    y += 135 + 45 * (0.5 + 0.5 * Math.sin(i * 2.399));
  }
  return paths;
}

function triangularLattice(height: number) {
  const triangles: [Point, Point, Point][] = [];
  const outline: Point[] = [[portraitFlow(-320), -320]];
  for (let y = -320, i = 0; y < height + 320; i++) {
    const span = 270 + 64 * Math.sin(i * 1.73);
    const side = i % 2 ? 1 : -1;
    const a: Point = [portraitFlow(y), y],
      b: Point = [
        Math.max(22, Math.min(398, portraitFlow(y + span / 2) + side * 138)),
        y + span * 0.48,
      ],
      c: Point = [portraitFlow(y + span), y + span];
    triangles.push([a, b, c]);
    // Trace every triangle back to its anchor and continue from its last tip.
    // One unbroken path, without a straight closing chord through the page.
    outline.push(b, c, a, c);
    y += span;
  }
  const paths = [stroke(line(outline), 0)];
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
  let last: Point = [portraitFlow(-420), -420];
  for (let y = -420, i = 0; y < height + 420; i++) {
    y += 180 + 34 * Math.sin(i * 2.399);
    const next: Point = [portraitFlow(y), y];
    edge(last, next, 3, i % 2 ? 1 : -1);
    last = next;
  }
  points.push(last);
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
    distance2 = dx * dx + dy * dy;
  const points: Point[] = [];
  for (let y = -260, i = 0; y < height + 260; i++) {
    const step = 178 + 22 * Math.sin(i * 1.73);
    const startX = portraitFlow(y);
    const deltaX = portraitFlow(y + step) - startX;
    const side = i % 2 ? -1 : 1;
    base.forEach(([x, v], index) => {
      if (index === 0 && points.length) return;
      const along = (x * dx + v * dy) / distance2;
      const across = (side * (x * dy - v * dx)) / distance2;
      // Similarity transform onto each drifting endpoint, preserving the
      // dragon's right angles; no nonuniform stretching or disconnected tiles.
      points.push([
        startX + along * deltaX + across * step,
        y + along * step - across * deltaX,
      ]);
    });
    y += step;
  }
  return [{ ...stroke(line(points), 0), width: 2, accent: true }];
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
