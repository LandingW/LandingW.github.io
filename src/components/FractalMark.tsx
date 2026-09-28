// Sierpiński triangle: a small geometric signature, not a background animation.
export default function FractalMark({
  className = "",
  depth = 3,
}: {
  className?: string;
  depth?: number;
}) {
  const polygons: string[] = [];
  type Point = [number, number];
  const midpoint = (a: Point, b: Point): Point => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  const subdivide = (a: Point, b: Point, c: Point, level: number) => {
    if (level === 0) {
      polygons.push([a, b, c].map((point) => point.join(",")).join(" "));
      return;
    }
    const ab = midpoint(a, b),
      bc = midpoint(b, c),
      ca = midpoint(c, a);
    subdivide(a, ab, ca, level - 1);
    subdivide(ab, b, bc, level - 1);
    subdivide(ca, bc, c, level - 1);
  };
  subdivide([32, 2], [2, 56], [62, 56], Math.min(4, Math.max(0, depth)));
  return (
    <svg
      className={className}
      width="64"
      height="58"
      viewBox="0 0 64 58"
      aria-hidden="true"
      fill="currentColor"
    >
      {polygons.map((points, index) => (
        <polygon key={index} points={points} />
      ))}
    </svg>
  );
}
