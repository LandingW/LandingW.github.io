// Deterministic, self-contained graphic studies. No remote image or HDR assets.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Matrix4, Euler, PerspectiveCamera, Vector3 } from "three";
import { TeapotGeometry } from "three/addons/geometries/TeapotGeometry.js";
import { teapotView } from "../src/lib/study-config.mjs";

const output = path.resolve("public/studies");
await fs.mkdir(output, { recursive: true });

async function teapotPoster() {
  const width = 800,
    height = 640;
  const geometry = new TeapotGeometry(
    teapotView.size,
    14,
    true,
    true,
    true,
    true,
    true,
  );
  const rotation = new Matrix4().makeRotationFromEuler(
    new Euler(...teapotView.rotation),
  );
  const camera = new PerspectiveCamera(teapotView.fov, width / height, 0.1, 30);
  camera.position.set(...teapotView.camera);
  camera.lookAt(...teapotView.target);
  camera.updateMatrixWorld();
  const position = geometry.attributes.position,
    normals = geometry.attributes.normal,
    indices = geometry.index.array;
  const faces = [];
  for (let i = 0; i < indices.length; i += 3) {
    const points = [indices[i], indices[i + 1], indices[i + 2]].map((index) =>
      new Vector3().fromBufferAttribute(position, index).applyMatrix4(rotation),
    );
    const center = points[0]
      .clone()
      .add(points[1])
      .add(points[2])
      .divideScalar(3);
    const normal = [indices[i], indices[i + 1], indices[i + 2]]
      .map((index) =>
        new Vector3()
          .fromBufferAttribute(normals, index)
          .transformDirection(rotation),
      )
      .reduce((sum, value) => sum.add(value), new Vector3())
      .normalize();
    const view = camera.position.clone().sub(center).normalize();
    if (normal.dot(view) < -0.08) continue;
    const reflection = view.clone().negate().reflect(normal);
    const strip = Math.pow(
      Math.max(0, Math.cos(reflection.y * 6 + reflection.x * 2)),
      10,
    );
    const rim = Math.pow(1 - Math.max(0, normal.dot(view)), 2);
    const brightness = Math.min(
      1,
      0.12 + 0.42 * Math.max(0, normal.y + 0.25) + 0.57 * strip + 0.22 * rim,
    );
    const channels = [215, 224, 209].map((value) =>
      Math.round(22 + value * brightness),
    );
    const projected = points.map((point) => {
      const p = point.clone().project(camera);
      return `${(((p.x + 1) * width) / 2).toFixed(2)},${(((1 - p.y) * height) / 2).toFixed(2)}`;
    });
    faces.push({
      z: center.distanceToSquared(camera.position),
      markup: `<path d="M${projected.join("L")}Z" fill="rgb(${channels})" stroke="rgb(${channels})" stroke-width=".7"/>`,
    });
  }
  faces.sort((a, b) => b.z - a.z);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><radialGradient id="shadow"><stop stop-color="#283522" stop-opacity=".15"/><stop offset="1" stop-color="#283522" stop-opacity="0"/></radialGradient></defs><ellipse cx="400" cy="513" rx="220" ry="37" fill="url(#shadow)"/>${faces.map((face) => face.markup).join("")}</svg>`;
  await sharp(Buffer.from(svg))
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(output, "utah-teapot.webp"));
  geometry.dispose();
  console.log("Generated canonical Utah teapot poster.");
}

// Small diffuse path tracer with next-event estimation and analytic room/box intersections.
// This is an independent Cornell-style study, not a photograph of the original experiment.
async function cornellBox() {
  const size = 480,
    samples = 160,
    pixels = Buffer.alloc(size * size * 3);
  let seed = 11939;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const normalize = (a) => mul(a, 1 / Math.sqrt(dot(a, a)));
  const boxes = [
    { center: [-0.38, -0.65, 0.18], half: [0.29, 0.35, 0.29], angle: 0.29 },
    { center: [0.35, -0.29, -0.3], half: [0.29, 0.71, 0.29], angle: -0.25 },
  ].map((box) => ({
    ...box,
    cos: Math.cos(box.angle),
    sin: Math.sin(box.angle),
  }));
  const white = [0.73, 0.72, 0.66];
  function intersect(origin, direction) {
    let hit = null,
      closest = 100;
    for (let axis = 0; axis < 3; axis++) {
      for (const side of [-1, 1]) {
        if ((axis === 2 && side === 1) || Math.abs(direction[axis]) < 1e-8)
          continue;
        const t = (side - origin[axis]) / direction[axis];
        if (t < 0.0001 || t >= closest) continue;
        const p = add(origin, mul(direction, t));
        if (
          p.some((value, index) => index !== axis && Math.abs(value) > 1.0001)
        )
          continue;
        const n = [0, 0, 0];
        n[axis] = -side;
        closest = t;
        hit = {
          t,
          p,
          n,
          color:
            axis === 0
              ? side < 0
                ? [0.65, 0.075, 0.035]
                : [0.085, 0.4, 0.095]
              : white,
          light:
            axis === 1 &&
            side === 1 &&
            Math.abs(p[0]) < 0.32 &&
            p[2] > -0.28 &&
            p[2] < 0.28,
        };
      }
    }
    for (const box of boxes) {
      const q = origin.map((value, i) => value - box.center[i]);
      const o = [
        box.cos * q[0] - box.sin * q[2],
        q[1],
        box.sin * q[0] + box.cos * q[2],
      ];
      const d = [
        box.cos * direction[0] - box.sin * direction[2],
        direction[1],
        box.sin * direction[0] + box.cos * direction[2],
      ];
      let near = -Infinity,
        far = Infinity,
        normal = [0, 0, 0];
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(d[axis]) < 1e-8) {
          if (Math.abs(o[axis]) > box.half[axis]) {
            far = -Infinity;
            break;
          }
          continue;
        }
        const t1 = (-box.half[axis] - o[axis]) / d[axis],
          t2 = (box.half[axis] - o[axis]) / d[axis];
        const entry = Math.min(t1, t2);
        if (entry > near) {
          near = entry;
          normal = [0, 0, 0];
          normal[axis] = d[axis] > 0 ? -1 : 1;
        }
        far = Math.min(far, Math.max(t1, t2));
      }
      if (near > 0.0001 && near < far && near < closest) {
        closest = near;
        hit = {
          t: near,
          p: add(origin, mul(direction, near)),
          n: [
            box.cos * normal[0] + box.sin * normal[2],
            normal[1],
            -box.sin * normal[0] + box.cos * normal[2],
          ],
          color: white,
          light: false,
        };
      }
    }
    return hit;
  }
  function trace(origin, direction, depth = 0) {
    const hit = intersect(origin, direction);
    if (!hit) return [0.012, 0.013, 0.011];
    if (hit.light) return depth === 0 ? [12, 11.5, 10.5] : [0, 0, 0];
    const p = add(hit.p, mul(hit.n, 0.0002));
    const light = [(random() - 0.5) * 0.64, 0.998, (random() - 0.5) * 0.56];
    const delta = light.map((value, i) => value - p[i]),
      distance2 = dot(delta, delta),
      distance = Math.sqrt(distance2),
      toLight = mul(delta, 1 / distance);
    const occluder = intersect(p, toLight);
    const direct =
      !occluder || occluder.t >= distance - 0.001
        ? (Math.max(0, dot(hit.n, toLight)) *
            Math.max(0, toLight[1]) *
            (0.64 * 0.56)) /
          (Math.PI * distance2)
        : 0;
    const color = [12 * direct, 11.5 * direct, 10.5 * direct];
    if (depth < 2) {
      const r = Math.sqrt(random()),
        angle = 2 * Math.PI * random();
      const tangent = normalize(
        cross(Math.abs(hit.n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], hit.n),
      );
      const bitangent = cross(hit.n, tangent);
      const bounce = add(
        add(
          mul(tangent, r * Math.cos(angle)),
          mul(bitangent, r * Math.sin(angle)),
        ),
        mul(hit.n, Math.sqrt(1 - r * r)),
      );
      const indirect = trace(p, bounce, depth + 1);
      for (let c = 0; c < 3; c++) color[c] += indirect[c];
    }
    return color.map((value, i) => value * hit.color[i]);
  }
  const camera = [0, 0.02, 3.35];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = [0, 0, 0];
      for (let s = 0; s < samples; s++) {
        const direction = normalize([
          (((x + random()) / size) * 2 - 1) * 0.345,
          (1 - ((y + random()) / size) * 2) * 0.345 - 0.005,
          -1,
        ]);
        const sample = trace(camera, direction);
        for (let c = 0; c < 3; c++) color[c] += sample[c] / samples;
      }
      for (let c = 0; c < 3; c++) {
        const v = color[c] * 1.65;
        const mapped = Math.min(
          1,
          (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14),
        );
        pixels[(y * size + x) * 3 + c] = Math.round(
          255 * Math.pow(mapped, 1 / 2.2),
        );
      }
    }
    if (y % 120 === 0)
      console.log(`Cornell study ${Math.round((y / size) * 100)}%`);
  }
  await sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
    .blur(0.35)
    .webp({ quality: 92 })
    .toFile(path.join(output, "cornell-box.webp"));
  console.log("Generated Cornell-style lighting study.");
}

await teapotPoster();
await cornellBox();
