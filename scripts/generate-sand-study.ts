import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { renderSand, type SandFormat } from "../src/lib/sand-raster";

async function main() {
  await mkdir("public/studies", { recursive: true });
  for (const [format, width, height] of [
    ["landscape", 1680, 1400],
    ["portrait", 840, 1960],
  ] as [SandFormat, number, number][]) {
    const pixels = renderSand(width, height, format);
    const info = await sharp(pixels, { raw: { width, height, channels: 4 } })
      .webp({ quality: 80, alphaQuality: 65, effort: 6 })
      .toFile(`public/studies/sand-${format}.webp`);
    console.log(JSON.stringify({ artFormat: format, ...info }));
  }
}
void main();
