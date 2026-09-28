import { CatmullRomCurve3, Vector3 } from "three";

export default function SplineStudy() {
  const curve = new CatmullRomCurve3(
    [
      new Vector3(-2, -0.45, 0),
      new Vector3(-1.2, 0.7, 0.2),
      new Vector3(-0.1, 0.75, -0.7),
      new Vector3(0.5, -0.6, 0.4),
      new Vector3(1.4, -0.5, -0.15),
      new Vector3(2, 0.35, 0),
    ],
    false,
    "centripetal",
  );
  const frames = curve.computeFrenetFrames(64, false);
  const project = (point: Vector3) =>
    [
      (point.x * 60 + point.z * 18 + 146).toFixed(2),
      (82 - point.y * 62 + point.z * 17).toFixed(2),
    ].join(",");
  const paths = Array.from({ length: 10 }, (_, radial) =>
    Array.from({ length: 65 }, (_, index) => {
      const angle = (radial / 10) * Math.PI * 2;
      const point = curve
        .getPointAt(index / 64)
        .addScaledVector(frames.normals[index], 0.14 * Math.cos(angle))
        .addScaledVector(frames.binormals[index], 0.14 * Math.sin(angle));
      return (index ? "L" : "M") + project(point);
    }).join(" "),
  );
  return (
    <figure className="spline-study">
      <svg
        viewBox="0 0 292 166"
        width="292"
        height="166"
        fill="none"
        role="img"
        aria-label="由 Catmull–Rom 样条与截面生成的管状曲面线稿"
      >
        {paths.map((d, index) => (
          <path d={d} key={index} stroke="currentColor" strokeWidth=".65" />
        ))}
      </svg>
      <figcaption className="mono">CONTINUITY / A SPLINE STUDY</figcaption>
    </figure>
  );
}
