import type { Env } from "./index";
import { HttpError } from "./http";

export async function dispatchProcessing(
  env: Env,
  inputs: Record<string, string | boolean> = {},
) {
  let problem = "";
  try {
    if (!env.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY))
      throw new Error("GitHub 图片处理凭据尚未配置");
    const response = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/photos.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "landingw-photos",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs }),
        signal: AbortSignal.timeout(15000),
        // Workers supports manual/follow, not the browser's "error" mode.
        // Keep credentials on this exact endpoint; !ok rejects any redirect.
        redirect: "manual",
      },
    );
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 403
          ? "GitHub 处理授权不可用，请检查凭据有效期与 Actions 写入权限"
          : `GitHub 暂未接受处理任务（HTTP ${response.status}），原片已保留，请重试处理待办`,
      );
  } catch (error) {
    problem =
      error instanceof Error && error.message.startsWith("GitHub")
        ? error.message
        : "图片处理触发暂时失败，原片已保留，系统会补查；也可点击处理待办";
  }
  await env.DB.prepare(
    "INSERT INTO service_events(key,value) VALUES('photo-dispatch',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(
      JSON.stringify({
        ok: !problem,
        message: problem || "已提交高清处理任务，等待执行器领取",
        at: new Date().toISOString(),
      }),
    )
    .run();
  if (problem) throw new HttpError(502, problem);
}

// Independent of the uploading tab. A cron sweep closes the debounce/runner-exit
// race, and also recovers uploads whose browser disappeared before batch end.
export async function kickQueuedProcessing(env: Env) {
  const stale = new Date(Date.now() - 3600_000).toISOString();
  const work = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM photos WHERE deleted_at IS NULL AND (state='queued' OR (state='processing' AND updated_at<?) OR (state='ready' AND (metadata_state='queued' OR (metadata_state='processing' AND metadata_updated_at<?))))",
  )
    .bind(stale, stale)
    .first<{ count: number }>();
  if (!work?.count) return;
  const active = await env.DB.prepare(
    "SELECT id FROM photos WHERE deleted_at IS NULL AND ((state='processing' AND updated_at>=?) OR (metadata_state='processing' AND metadata_updated_at>=?)) LIMIT 1",
  )
    .bind(stale, stale)
    .first();
  if (active) return;
  const now = Date.now();
  const claim = await env.DB.prepare(
    "INSERT INTO service_limits(key,next_at) VALUES('photo-dispatch',?) ON CONFLICT(key) DO UPDATE SET next_at=excluded.next_at WHERE service_limits.next_at<=?",
  )
    .bind(now + 90000, now)
    .run();
  if (!claim.meta.changes) return;
  await dispatchProcessing(env);
}
