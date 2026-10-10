import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import sodium from "libsodium-wrappers";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = "LandingW/LandingW.github.io";
const configFile = "workers/photos/wrangler.jsonc";

export function validatePhotoCredentials({
  accessKey,
  secretKey,
  dispatchToken,
  adminToken,
}) {
  if (!/^[a-f0-9]{32}$/i.test(accessKey))
    throw new Error(
      "R2 Access Key ID 应是 32 位十六进制字符，请勿填写账号 ID 或 API token。",
    );
  if (!/^[a-f0-9]{64}$/i.test(secretKey))
    throw new Error("R2 Secret Access Key 应是 64 位十六进制字符。");
  if (!/^github_pat_[a-zA-Z0-9_]{30,}$/.test(dispatchToken))
    throw new Error(
      "请使用 GitHub fine-grained token，不使用通用 classic token。",
    );
  if (
    adminToken.length < 12 ||
    adminToken.length > 256 ||
    /[\x00-\x20\x7f]/.test(adminToken)
  )
    throw new Error(
      "相册管理密码至少 12 个字符，不含空格，最长 256 个字符；由你自己设置。",
    );
  if ([accessKey, secretKey, dispatchToken].includes(adminToken))
    throw new Error("管理口令不能复用服务密钥。");
}

export async function encryptGithubSecret(value, publicKey) {
  await sodium.ready;
  const key = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  if (key.length !== sodium.crypto_box_PUBLICKEYBYTES)
    throw new Error("GitHub 公钥格式不正确。");
  return sodium.to_base64(
    sodium.crypto_box_seal(sodium.from_string(value), key),
    sodium.base64_variants.ORIGINAL,
  );
}

async function promptHidden(label) {
  process.stdout.write(`${label}（输入不回显）: `);
  const silent = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output: silent,
    terminal: true,
  });
  try {
    return (await rl.question("")).trim();
  } finally {
    rl.close();
    process.stdout.write("\n");
  }
}

function githubLogin() {
  let output;
  try {
    // Standard Git credential lookup, only for this GitHub account. Captured in
    // memory; it is used solely against api.github.com, never sent to Cloudflare.
    output = execFileSync("git", ["credential", "fill"], {
      cwd: root,
      input: "protocol=https\nhost=github.com\nusername=LandingW\n\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
      },
    });
  } catch {
    throw new Error(
      "本机 GitHub 登录不可用，请先完成 git credential-manager github login。",
    );
  }
  const token = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("password="))
    ?.slice(9);
  if (!token) throw new Error("未找到 GitHub 登录凭据。");
  return token;
}

async function github(pathname, token, method = "GET", body) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "landingw-photo-setup",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(
      `GitHub 配置请求失败（HTTP ${response.status}）。请检查账号和仓库权限；未输出响应正文。`,
    );
  return response.status === 204 ? null : response.json();
}

async function workerSecrets(secrets) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/wrangler/bin/wrangler.js"),
        "secret",
        "bulk",
        "--config",
        configFile,
      ],
      {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: {
          ...process.env,
          WRANGLER_SEND_METRICS: "false",
          WRANGLER_LOG: "error",
        },
      },
    );
    // Deliberately do not forward child output: never print secret payloads,
    // raw HTTP errors, or signed request details on an error path.
    child.stdout.resume();
    child.stderr.resume();
    child.on("error", () =>
      reject(new Error("无法运行 Cloudflare 配置工具。")),
    );
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "写入 Cloudflare Secrets 失败，请检查 wrangler 登录；没有打印输入值。",
            ),
          ),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(secrets));
  });
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(
      "请在你自己的交互式 PowerShell 中运行，不支持通过文件、管道或聊天传入密钥。",
    );
  const configText = await fs.readFile(path.join(root, configFile), "utf8");
  const account = configText.match(/"account_id"\s*:\s*"([a-f0-9]{32})"/)?.[1];
  const publicConfig = JSON.parse(
    await fs.readFile(path.join(root, "public/travel-config.json"), "utf8"),
  );
  if (
    !account ||
    !/^https:\/\/landingw-photos\.[a-z0-9-]+\.workers\.dev$/.test(
      publicConfig.apiUrl,
    )
  )
    throw new Error("请先让助手完成账号和 Worker 地址配置。");
  console.log(`目标：Cloudflare 账号 ${account}；GitHub ${repository}`);
  console.log(
    "本命令只配置本影集服务的固定 Secret 名称，不把输入写入文件、日志或代码。",
  );
  console.log(
    "请先停止正在运行的图片处理任务。重复配置会替换本影集的密钥与管理口令。",
  );
  console.log(
    "本机 Git 登录只用于把加密后的 Secrets 写入 GitHub；不会传给 Cloudflare。",
  );
  const loginToken = githubLogin();
  const user = await github("/user", loginToken);
  if (user.login.toLowerCase() !== "landingw")
    throw new Error("本机 GitHub 登录不是 LandingW，请切换账号后重试。");
  const publicKey = await github(
    `/repos/${repository}/actions/secrets/public-key`,
    loginToken,
  );
  const accessKey = await promptHidden("R2 Access Key ID");
  if (accessKey.toLowerCase() === account) {
    throw new Error(
      "这是 Cloudflare Account ID，不是上传凭据的 Access Key ID；请从新建的 R2 API token 结果中复制 Access Key ID。",
    );
  }
  const secretKey = await promptHidden("R2 Secret Access Key");
  const dispatchToken = await promptHidden(
    "GitHub fine-grained token（仅此仓库 Actions 读写）",
  );
  const adminToken = await promptHidden(
    "你自己设置的相册管理密码（至少 12 个字符，请自行保存）",
  );
  validatePhotoCredentials({ accessKey, secretKey, dispatchToken, adminToken });

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    maxAttempts: 2,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  try {
    for (const Bucket of ["landingw-photo-originals", "landingw-photo-public"])
      await s3.send(new HeadBucketCommand({ Bucket }));
  } catch {
    throw new Error(
      "R2 凭据验证失败，请确认是这个账号、且仅授权了两个照片桶的 Object Read & Write 凭据。",
    );
  } finally {
    s3.destroy();
  }
  await github(
    `/repos/${repository}/actions/workflows?per_page=1`,
    dispatchToken,
  );

  const processorToken = randomBytes(32).toString("hex");
  await workerSecrets({
    ADMIN_TOKEN: adminToken,
    PROCESSOR_TOKEN: processorToken,
    R2_ACCESS_KEY_ID: accessKey,
    R2_SECRET_ACCESS_KEY: secretKey,
    GITHUB_TOKEN: dispatchToken,
  });
  console.log("Cloudflare：5 项服务密钥已安全写入。");
  const secrets = {
    PHOTO_WORKER_URL: publicConfig.apiUrl,
    PHOTO_PROCESSOR_TOKEN: processorToken,
    R2_ACCOUNT_ID: account,
    R2_ACCESS_KEY_ID: accessKey,
    R2_SECRET_ACCESS_KEY: secretKey,
  };
  for (const [name, value] of Object.entries(secrets)) {
    await github(
      `/repos/${repository}/actions/secrets/${name}`,
      loginToken,
      "PUT",
      {
        encrypted_value: await encryptGithubSecret(value, publicKey.key),
        key_id: publicKey.key_id,
      },
    );
  }
  console.log("GitHub：5 项 Actions Secrets 已加密写入。其他 Secrets 未改动。");
  console.log("配置完成。请只回复助手“密钥配置完成”，不要发送任何密钥或截图。");
  console.log(
    "管理页面使用刚才你输入的管理口令。机器处理口令由程序生成，不需要你记住。",
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  void main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "配置未完成，请检查账号授权。",
    );
    process.exitCode = 1;
  });
}
