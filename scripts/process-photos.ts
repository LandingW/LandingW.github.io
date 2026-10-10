import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { generatePhoto } from "./photo-processing";
import { readPhotoMetadata } from "./photo-exif";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少配置：${name}`);
  return value;
}
const base = env("PHOTO_WORKER_URL").replace(/\/$/, ""),
  token = env("PHOTO_PROCESSOR_TOKEN");
const account = env("R2_ACCOUNT_ID"),
  bucket = env("R2_PUBLIC_BUCKET");
const onlyId = process.env.PHOTO_ID || "";
const onlyAlbum = process.env.PHOTO_ALBUM_ID || "";
if (onlyAlbum && !/^[a-zA-Z0-9_-]{1,80}$/.test(onlyAlbum))
  throw new Error("旅行编号不正确");
if (onlyId && !/^[a-zA-Z0-9_-]{1,80}$/.test(onlyId))
  throw new Error("照片编号不正确");
if (!/^https:\/\/[^/?#]+$/.test(base) || !/^[a-f0-9]{32}$/.test(account))
  throw new Error("服务地址或 R2 账号编号不正确");
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${account}.r2.cloudflarestorage.com`,
  maxAttempts: 3,
  credentials: {
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  },
});
async function api(endpoint: string, data: unknown = {}) {
  const response = await fetch(base + endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`处理接口返回 ${response.status}`);
  return response.json();
}
async function complete(endpoint: string, data: unknown) {
  try {
    return await api(endpoint, data);
  } catch {
    return api(endpoint, data);
  } // Completion callbacks are idempotent.
}
interface Job {
  id: string;
  lease: string;
  revision?: string;
  bytes: number;
  sourceUrl: string;
  prefix?: string;
}
async function main() {
  let failures = 0;
  const modes =
    process.env.PHOTO_METADATA_ONLY === "true" ? [true] : [false, true];
  for (const metadataOnly of modes) {
    for (let count = 0; count < 100; count++) {
      const { job }: { job: Job | null } = await api(
        metadataOnly ? "/internal/metadata/claim" : "/internal/claim",
        {
          photoId: onlyId,
          albumId: onlyAlbum,
        },
      );
      if (!job) break;
      if (
        !/^[\w-]+$/.test(job.id) ||
        (!metadataOnly &&
          (!job.revision ||
            !/^[\w-]+$/.test(job.revision) ||
            job.prefix !== `photos/${job.id}/${job.revision}/`)) ||
        new URL(job.sourceUrl).hostname !==
          `${account}.r2.cloudflarestorage.com`
      )
        throw new Error("处理任务来源不正确");
      const temp = await fs.mkdtemp(path.join(os.tmpdir(), "landingw-photo-")),
        uploaded: string[] = [];
      let allUploaded = false;
      try {
        const source = path.join(temp, "source"),
          output = path.join(temp, "derived");
        const response = await fetch(job.sourceUrl, {
          signal: AbortSignal.timeout(180000),
          redirect: "error",
        });
        if (!response.ok || !response.body) throw new Error("原文件下载失败");
        let bytes = 0;
        const limit = new Transform({
          transform(chunk, _encoding, callback) {
            bytes += chunk.length;
            callback(
              bytes > job.bytes || bytes > 64 * 1024 * 1024
                ? new Error("文件大小校验失败")
                : null,
              chunk,
            );
          },
        });
        await pipeline(
          Readable.fromWeb(
            response.body as import("node:stream/web").ReadableStream,
          ),
          limit,
          createWriteStream(source),
        );
        if (bytes !== job.bytes) throw new Error("文件大小校验失败");
        if (metadataOnly) {
          const metadata = await readPhotoMetadata(source);
          await complete(`/internal/photos/${job.id}/metadata/complete`, {
            lease: job.lease,
            metadata,
          });
          console.log(
            `Photo ${job.id}: EXIF updated; camera=${Boolean(metadata.camera)}; gps=${Boolean(metadata.gps)}; existing tiles unchanged.`,
          );
          continue;
        }
        const result = await generatePhoto(source, output),
          files = [...result.files];
        const uploads = await Promise.allSettled(
          Array.from({ length: 6 }, async () => {
            for (;;) {
              const file = files.shift();
              if (!file) return;
              const filename = path.join(output, file),
                key = job.prefix + file;
              await s3.send(
                new PutObjectCommand({
                  Bucket: bucket,
                  Key: key,
                  Body: createReadStream(filename),
                  ContentLength: (await fs.stat(filename)).size,
                  ContentType: /\.jpe?g$/.test(file)
                    ? "image/jpeg"
                    : "application/xml",
                  CacheControl: "public, max-age=31536000, immutable",
                }),
              );
              uploaded.push(key);
            }
          }),
        );
        if (uploads.some((upload) => upload.status === "rejected"))
          throw new Error("展示文件上传失败");
        allUploaded = true;
        await complete(`/internal/photos/${job.id}/complete`, {
          lease: job.lease,
          width: result.width,
          height: result.height,
          tileCount: result.tileCount,
          derivedBytes: result.derivedBytes,
          metadata: result.metadata,
        });
        console.log(
          `Photo ${job.id}: ready; ${result.tileCount} tiles; ${result.derivedBytes} derived bytes.`,
        );
      } catch {
        failures++;
        // Opaque IDs only. Do not print original filenames, signed URLs, EXIF or raw SDK errors.
        console.error(`Photo ${job.id}: processing failed.`);
        for (let i = 0; !allUploaded && i < uploaded.length; i += 1000) {
          await s3
            .send(
              new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: {
                  Objects: uploaded.slice(i, i + 1000).map((Key) => ({ Key })),
                },
              }),
            )
            .catch(() => {});
        }
        await api(
          `/internal/photos/${job.id}/${metadataOnly ? "metadata/" : ""}fail`,
          { lease: job.lease },
        ).catch(() => {});
      } finally {
        // This directory is owned by this invocation, not an input or user-selected folder.
        await fs.rm(temp, { recursive: true, force: true });
      }
    }
  }
  s3.destroy();
  if (failures) process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    "图片处理服务连接失败，请检查服务配置；未输出凭据或原始文件信息。",
  );
  process.exitCode = 1;
  s3.destroy();
});
