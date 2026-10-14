import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { renderInk, type InkFormat } from "../src/lib/ink-raster";

async function main() {
  await mkdir("public/studies", { recursive: true });
  for (const [format, width, height] of [
    ["landscape", 1680, 1400],
    ["portrait", 840, 1960],
  ] as [InkFormat, number, number][]) {
    const pixels = renderInk(width, height, format);
    const info = await sharp(pixels, { raw: { width, height, channels: 4 } })
      .webp({ quality: 82, alphaQuality: 70, effort: 6 })
      .toFile(`public/studies/ink-${format}.webp`);
    console.log(JSON.stringify({ artFormat: format, ...info }));
  }
}
void main();
