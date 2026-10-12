import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";

interface Item {
  id: string;
  file: string;
  bytes: number;
  sha256: string;
  mime: string;
  uploaded?: boolean;
  registered?: boolean;
}
interface ImportPlan {
  source: string;
  albumId: string;
  title: string;
  createdAt: string;
  files: Item[];
}
const root = process.cwd();
const config = "workers/photos/wrangler.jsonc";
const bucket = "landingw-photo-originals";
const quota = 2_000_000_000;
const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;

async function wrangler(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/wrangler/bin/wrangler.js"),
        ...args,
        "--config",
        config,
      ],
      {
        cwd: root,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.resume();
    child.on("error", () => reject(new Error("无法启动上传工具")));
    child.on("exit", (code) =>
      code === 0
        ? resolve(output)
        : reject(
            new Error(
              `Cloudflare 操作失败（${args.slice(0, 3).join(" ")}），可用原导入清单继续`,
            ),
          ),
    );
  });
}
async function query(command: string): Promise<Record<string, unknown>[]> {
  const output = await wrangler([
    "d1",
    "execute",
    "landingw-photos",
    "--remote",
    "--command",
    command,
    "--json",
  ]);
  const result = JSON.parse(output);
  if (!Array.isArray(result) || result.some((item) => !item.success))
    throw new Error("数据库操作未完成");
  return result.flatMap((item) => item.results || []);
}
async function hash(file: string) {
  return createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}
async function main() {
  const args = process.argv.slice(2),
    upload = args.includes("--upload"),
    resume = args.indexOf("--resume");
  let plan: ImportPlan, manifestPath: string;
  if (resume >= 0) {
    manifestPath = path.resolve(args[resume + 1]);
    if (!manifestPath.startsWith(path.resolve("photo-output") + path.sep))
      throw new Error("导入清单必须位于本仓库 photo-output 中");
    plan = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } else {
    if (!args[0] || args[0].startsWith("--"))
      throw new Error(
        '用法：npx tsx scripts/import-photo-folder.ts "图片目录" [--upload]',
      );
    const source = await fs.realpath(path.resolve(args[0])),
      albumId = randomUUID();
    const files: Item[] = [];
    for (const entry of (
      await fs.readdir(source, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !/\.(jpe?g|png|webp)$/i.test(entry.name)
      )
        continue;
      const file = path.join(source, entry.name),
        stat = await fs.stat(file),
        metadata = await sharp(file, {
          limitInputPixels: 200_000_000,
        }).metadata();
      if (
        stat.size < 1 ||
        stat.size > 64 * 1024 * 1024 ||
        !["jpeg", "png", "webp"].includes(metadata.format || "") ||
        (metadata.pages || 1) !== 1
      )
        throw new Error(`文件不符合上传限制：${entry.name}`);
      files.push({
        id: randomUUID(),
        file,
        bytes: stat.size,
        sha256: await hash(file),
        mime: `image/${metadata.format}`,
      });
    }
    if (!files.length) throw new Error("目录内没有支持的照片");
    plan = {
      source,
      albumId,
      title: `待整理 · ${path.basename(source)}`.slice(0, 100),
      createdAt: new Date().toISOString(),
      files,
    };
    const output = path.resolve("photo-output", `import-${albumId}`);
    await fs.mkdir(output, { recursive: true });
    manifestPath = path.join(output, "manifest.json");
  }
  const save = () => fs.writeFile(manifestPath, JSON.stringify(plan, null, 2));
  await save();
  const total = plan.files.reduce((sum, file) => sum + file.bytes, 0);
  console.log(
    JSON.stringify({
      manifestPath,
      albumId: plan.albumId,
      files: plan.files.length,
      bytes: total,
      upload,
      published: false,
    }),
  );
  if (!upload) return;
  if (
    !/^[a-f0-9-]{36}$/.test(plan.albumId) ||
    plan.files.some((item) => !/^[a-f0-9-]{36}$/.test(item.id))
  )
    throw new Error("导入清单编号不正确");
  const usage = await query(
    "SELECT COALESCE(SUM(bytes),0) AS bytes FROM photos WHERE state!='aborted'",
  );
  const remaining = plan.files
    .filter((item) => !item.registered)
    .reduce((sum, item) => sum + item.bytes, 0);
  if (Number(usage[0]?.bytes) + remaining > quota)
    throw new Error("本次导入将超过 2GB 原片额度，尚未开始上传");
  await query(
    `INSERT INTO albums(id,title,description,place,date,latitude,longitude,published,created_at) VALUES(${sql(plan.albumId)},${sql(plan.title)},'从本地目录导入，待确认旅行名称、地点和封面','','',NULL,NULL,0,${sql(plan.createdAt)}) ON CONFLICT(id) DO NOTHING;`,
  );
  let index = 0;
  for (const item of plan.files) {
    index++;
    const absolute = await fs.realpath(item.file);
    if (
      !absolute.startsWith(plan.source + path.sep) ||
      (await fs.stat(absolute)).size !== item.bytes ||
      (await hash(absolute)) !== item.sha256
    )
      throw new Error("文件已变更或超出已选目录，停止导入");
    const key = `originals/${item.id}/source`;
    const existing = await query(
      `SELECT original_key,bytes FROM photos WHERE id=${sql(item.id)}`,
    );
    if (existing.length) {
      if (
        existing[0].original_key !== key ||
        Number(existing[0].bytes) !== item.bytes
      )
        throw new Error("照片编号与已有记录冲突");
      await query(
        `INSERT OR IGNORE INTO album_photos(album_id,photo_id,position) VALUES(${sql(plan.albumId)},${sql(item.id)},(SELECT COALESCE(MAX(position),-1)+1 FROM album_photos WHERE album_id=${sql(plan.albumId)}));`,
      );
      item.registered = true;
      await save();
      console.log(`${index}/${plan.files.length}: already registered`);
      continue;
    }
    if (!item.uploaded) {
      await wrangler([
        "r2",
        "object",
        "put",
        `${bucket}/${key}`,
        "--file",
        absolute,
        "--remote",
        "--content-type",
        item.mime,
        "--force",
      ]);
      item.uploaded = true;
      await save();
    }
    const timestamp = new Date().toISOString();
    const added = await query(
      `INSERT INTO photos(id,album_id,original_key,filename,mime,bytes,fingerprint,state,created_at,updated_at) SELECT ${sql(item.id)},${sql(plan.albumId)},${sql(key)},${sql(path.basename(item.file))},${sql(item.mime)},${item.bytes},${sql(item.sha256)},'queued',${sql(timestamp)},${sql(timestamp)} WHERE (SELECT COALESCE(SUM(bytes),0) FROM photos WHERE state!='aborted')+${item.bytes}<=${quota} RETURNING id;`,
    );
    if (!added.length)
      throw new Error(
        "额度已被其他上传占用，原片已在私有桶，稍后可用清单继续注册",
      );
    await query(
      `INSERT OR IGNORE INTO album_photos(album_id,photo_id,position) VALUES(${sql(plan.albumId)},${sql(item.id)},(SELECT COALESCE(MAX(position),-1)+1 FROM album_photos WHERE album_id=${sql(plan.albumId)}));`,
    );
    item.registered = true;
    await save();
    console.log(`${index}/${plan.files.length}: uploaded privately and queued`);
  }
  console.log(
    JSON.stringify({
      albumId: plan.albumId,
      uploaded: plan.files.length,
      bytes: total,
      status: "draft-queued",
      manifestPath,
    }),
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "导入未完成");
  process.exitCode = 1;
});
