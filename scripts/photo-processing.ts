import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

export interface ProcessedPhoto {
  width: number;
  height: number;
  tileCount: number;
  derivedBytes: number;
  files: string[];
}

async function filesIn(directory: string, relative = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(directory, relative), {
    withFileTypes: true,
  });
  const children = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isSymbolicLink()) throw new Error("不允许处理符号链接");
      const name = path.posix.join(relative, entry.name);
      return entry.isDirectory() ? filesIn(directory, name) : [name];
    }),
  );
  return children.flat();
}

export async function generatePhoto(
  input: string,
  output: string,
): Promise<ProcessedPhoto> {
  await fs.mkdir(output, { recursive: true });
  if ((await fs.readdir(output)).length)
    throw new Error("输出目录必须为空，避免覆盖已有文件");
  const stat = await fs.stat(input);
  if (!stat.isFile() || stat.size > 64 * 1024 * 1024)
    throw new Error("原文件必须小于 64MiB");
  sharp.cache({ memory: 128, files: 20, items: 40 });
  sharp.concurrency(2);
  const image = sharp(input, {
    limitInputPixels: 200_000_000,
    failOn: "warning",
  });
  const metadata = await image.metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format || "") ||
    (metadata.pages || 1) !== 1 ||
    !metadata.width ||
    !metadata.height
  )
    throw new Error("仅支持静态 JPEG、PNG、WebP 照片");
  const rotated = (metadata.orientation || 1) >= 5;
  const width = rotated ? metadata.height : metadata.width,
    height = rotated ? metadata.width : metadata.height;
  // Sharp strips EXIF/GPS by default. Convert to sRGB before creating every derivative.
  const base = image.rotate().toColourspace("srgb");
  await base
    .clone()
    .resize({
      width: 1000,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82 })
    .toFile(path.join(output, "thumbnail.jpg"));
  await base
    .clone()
    .resize({
      width: 2560,
      height: 2560,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88 })
    .toFile(path.join(output, "preview.jpg"));
  await base
    .clone()
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .tile({
      size: 512,
      overlap: 1,
      layout: "dz",
      container: "fs",
      depth: "onepixel",
    })
    .toFile(path.join(output, "image"));
  // libvips emits a diagnostic sidecar which can contain source metadata/paths.
  // It is not required by Deep Zoom and must never be published.
  await fs.rm(path.join(output, "image_files", "vips-properties.xml"), {
    force: true,
  });
  const files = await filesIn(output);
  const sizes = await Promise.all(
    files.map(async (file) => (await fs.stat(path.join(output, file))).size),
  );
  const derivedBytes = sizes.reduce((sum, value) => sum + value, 0);
  if (derivedBytes > 512 * 1024 * 1024)
    throw new Error("展示文件超过 512MiB 限制，请降低原片尺寸后重试");
  return {
    width,
    height,
    tileCount: files.filter(
      (file) => file.startsWith("image_files/") && /\.jpe?g$/.test(file),
    ).length,
    derivedBytes,
    files,
  };
}
