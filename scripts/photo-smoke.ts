import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const mode = process.argv[2];
const originalBucket = "landingw-photo-originals",
  publicBucket = "landingw-photo-public";
function testId() {
  const id = process.env.PHOTO_ID || "";
  // Application-created photo IDs never have this prefix. Never accept normal
  // photo IDs here: this script can delete only its own synthetic fixtures.
  if (
    !/^smoke-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      id,
    )
  )
    throw new Error("Only synthetic smoke IDs are allowed");
  return id;
}
async function generate() {
  const id = `smoke-${randomUUID()}`,
    albumId = `smoke-${randomUUID()}`;
  const directory = path.resolve("photo-output", id);
  await fs.mkdir(directory, { recursive: true });
  const width = 8000,
    height = 6000,
    pixels = Buffer.alloc(width * height * 3);
  let seed = 123456789;
  for (let index = 0; index < pixels.length; index++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    pixels[index] = seed & 255;
  }
  const label = Buffer.from(
    '<svg width="8000" height="6000"><rect x="0" y="2550" width="8000" height="900" fill="#f2f1eb"/><text x="4000" y="2930" text-anchor="middle" font-family="sans-serif" font-size="210" fill="#1b241e">SYNTHETIC TEST IMAGE</text><text x="4000" y="3270" text-anchor="middle" font-family="sans-serif" font-size="140" fill="#df4b30">NOT A TRAVEL PHOTO</text></svg>',
  );
  const source = path.join(directory, "source.jpg");
  await sharp(pixels, { raw: { width, height, channels: 3 } })
    .composite([{ input: label }])
    .jpeg({ quality: 86, chromaSubsampling: "4:2:0" })
    .toFile(source);
  const bytes = (await fs.stat(source)).size,
    fingerprint = createHash("sha256")
      .update(await fs.readFile(source))
      .digest("hex");
  const fixture = { id, albumId, source, bytes, width, height, fingerprint };
  await fs.writeFile(
    path.join(directory, "fixture.json"),
    JSON.stringify(fixture, null, 2),
  );
  const timestamp = new Date().toISOString();
  await fs.writeFile(
    path.join(directory, "seed.sql"),
    `INSERT INTO albums(id,title,description,place,date,latitude,longitude,published,created_at) VALUES('${albumId}','合成测试图（非旅行记录）','','','',NULL,NULL,0,'${timestamp}');\nINSERT INTO photos(id,album_id,original_key,filename,mime,bytes,fingerprint,state,created_at,updated_at) VALUES('${id}','${albumId}','originals/${id}/source','synthetic-test.jpg','image/jpeg',${bytes},'${fingerprint}','queued','${timestamp}','${timestamp}');\n`,
  );
  console.log(JSON.stringify(fixture));
}
async function cloud() {
  const id = testId();
  if (mode === "guard") {
    console.log("Synthetic fixture scope verified.");
    return;
  }
  const account = process.env.R2_ACCOUNT_ID || "";
  if (!/^[a-f0-9]{32}$/.test(account)) throw new Error("Missing account");
  const config = JSON.parse(
    await fs.readFile("public/travel-config.json", "utf8"),
  );
  const media = new URL(config.mediaUrl);
  if (media.protocol !== "https:") throw new Error("HTTPS required");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    maxAttempts: 3,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
  const prefix = `photos/${id}/`,
    keys: string[] = [];
  try {
    let continuation: string | undefined;
    do {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: publicBucket,
          Prefix: prefix,
          ContinuationToken: continuation,
        }),
      );
      for (const entry of page.Contents || []) {
        if (!entry.Key?.startsWith(prefix))
          throw new Error("Object outside test prefix");
        keys.push(entry.Key);
      }
      continuation = page.NextContinuationToken;
    } while (continuation);
    if (mode === "cleanup") {
      for (let offset = 0; offset < keys.length; offset += 1000) {
        const result = await s3.send(
          new DeleteObjectsCommand({
            Bucket: publicBucket,
            Delete: {
              Objects: keys
                .slice(offset, offset + 1000)
                .map((Key) => ({ Key })),
            },
          }),
        );
        if (result.Errors?.length) throw new Error("Test cleanup failed");
      }
      await s3.send(
        new DeleteObjectCommand({
          Bucket: originalBucket,
          Key: `originals/${id}/source`,
        }),
      );
      console.log(
        `Removed ${keys.length} synthetic derivatives and the synthetic original.`,
      );
      return;
    }
    if (mode !== "verify") throw new Error("Unknown mode");
    const dzi = keys.find((key) => key.endsWith("/image.dzi"));
    if (!dzi || keys.some((key) => key.endsWith("vips-properties.xml")))
      throw new Error("Invalid tile set");
    const response = await fetch(`${media.origin}/${dzi}`, {
      signal: AbortSignal.timeout(20000),
    });
    const xml = await response.text();
    if (
      !response.ok ||
      !/TileSize="512"/.test(xml) ||
      !/Width="8000"/.test(xml) ||
      !/Height="6000"/.test(xml)
    )
      throw new Error("Invalid public Deep Zoom descriptor");
    const tile = keys.find(
      (key) => key.includes("/image_files/13/") && key.endsWith(".jpeg"),
    );
    if (!tile) throw new Error("Missing full-resolution tile");
    const tileResponse = await fetch(`${media.origin}/${tile}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (
      !tileResponse.ok ||
      !tileResponse.headers.get("content-type")?.includes("image/jpeg")
    )
      throw new Error("Tile request failed");
    const metadata = await sharp(
      Buffer.from(await tileResponse.arrayBuffer()),
    ).metadata();
    if (
      metadata.exif ||
      metadata.xmp ||
      !metadata.width ||
      metadata.width > 514
    )
      throw new Error("Tile metadata validation failed");
    await s3.send(
      new HeadObjectCommand({
        Bucket: originalBucket,
        Key: `originals/${id}/source`,
      }),
    );
    const anonymous = await fetch(
      `https://${account}.r2.cloudflarestorage.com/${originalBucket}/originals/${id}/source`,
      {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      },
    );
    if (anonymous.ok)
      throw new Error("Original unexpectedly accessible without authorization");
    console.log(
      `Verified ${keys.length} derivatives; public DZI/tile HTTP 200; EXIF removed; anonymous original denied (${anonymous.status}).`,
    );
  } finally {
    s3.destroy();
  }
}
void (mode === "generate" ? generate() : cloud()).catch(() => {
  console.error(
    "Synthetic photo verification failed; no credentials or signed URLs were logged.",
  );
  process.exitCode = 1;
});
