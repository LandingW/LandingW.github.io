/** Build-time complex dynamics. Never imported by the browser controller. */
export type JuliaPoint = [number, number];

export function juliaEscape(
  x: number,
  y: number,
  cr: number,
  ci: number,
  limit = 160,
) {
  let count = 0;
  while (x * x + y * y < 256 && count < limit) {
    const next = x * x - y * y + cr;
    y = 2 * x * y + ci;
    x = next;
    count++;
  }
  return count === limit
    ? limit
    : count + 1 - Math.log2(Math.log2(Math.hypot(x, y)));
}

export function simplifyJulia(
  points: readonly (readonly [number, number])[],
  tolerance: number,
): JuliaPoint[] {
  const keep = new Set([0, points.length - 1]);
  const queue = [[0, points.length - 1]];
  while (queue.length) {
    const [first, last] = queue.pop()!;
    const a = points[first],
      b = points[last];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = dx * dx + dy * dy;
    let furthest = -1,
      distance = tolerance * tolerance;
    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      const t = length
        ? Math.max(
            0,
            Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
          )
        : 0;
      const d = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
      if (d > distance) {
        distance = d;
        furthest = i;
      }
    }
    if (furthest !== -1) {
      keep.add(furthest);
      queue.push([first, furthest], [furthest, last]);
    }
  }
  return [...keep]
    .sort((a, b) => a - b)
    .map((i) => [
      Math.round(points[i][0] * 10) / 10,
      Math.round(points[i][1] * 10) / 10,
    ]);
}
