import { mkdir, writeFile } from "node:fs/promises";
import { traceContours } from "../src/lib/fractal-terrain";
import { juliaEscape, simplifyJulia } from "../src/lib/julia-math";
import {
  buildJuliaPlates,
  juliaPath,
  JULIA_VIEWBOX,
} from "../src/lib/julia-study";

async function main() {
  const size = 801,
    c = [-0.8, 0.156];
  const samples = new Float64Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      samples[y * size + x] = juliaEscape(
        (x / (size - 1) - 0.5) * 3.5,
        (y / (size - 1) - 0.5) * 3.5,
        c[0],
        c[1],
      );
  const bands = [10, 26, 58].map((level) => ({
    level,
    loops: traceContours(samples, size, size, 1000 / (size - 1), [0, 0], level)
      .filter((loop) => loop.closed && loop.points.length >= 90)
      .map((loop) =>
          simplifyJulia([...loop.points, loop.points[0]], 1.7).slice(0, -1),
      )
      .filter((loop) => loop.length > 8),
  }));
  const points = bands
    .flatMap((band) => band.loops)
    .reduce((n, loop) => n + loop.length, 0);
  await mkdir("src/lib/generated", { recursive: true });
  await writeFile(
    "src/lib/generated/julia-study.json",
    JSON.stringify({ c, size: 1000, bands }) + "\n",
  );
  await mkdir("public/studies", { recursive: true });
  for (const format of ["landscape", "portrait"] as const) {
    const [w, h] = JULIA_VIEWBOX[format];
    for (const [index, plate] of buildJuliaPlates(format, {
      bands,
    }).entries()) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill-rule="evenodd" stroke-linejoin="round"><g fill="${plate.ink}" stroke="${plate.ink}" stroke-width=".7">${plate.bands.map((b) => `<path d="${juliaPath(b.loops)}" fill-opacity="${b.fill}" stroke-opacity="${b.stroke}"/>`).join("")}</g></svg>`;
      await writeFile(`public/studies/julia-${format}-${index}.svg`, svg);
    }
  }
  await mkdir("photo-output", { recursive: true });
  const inks = ["#e2e7df", "#bccdc1", "#8aa797", "#5f8172"];
  const art = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="#f7f5ef"/>${bands.map((band, i) => `<path fill="${inks[i]}" stroke="#5e7b70" stroke-width=".6" fill-rule="evenodd" d="${band.loops.map((loop) => `M${loop.map((p) => p.join(",")).join("L")}Z`).join("")}"/>`).join("")}</svg>`;
  await writeFile("photo-output/julia-study.svg", art);
  console.log(
    JSON.stringify({ points, loops: bands.map((b) => b.loops.length) }),
  );
}
void main();
