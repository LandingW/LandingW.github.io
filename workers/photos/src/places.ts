import type { Env } from "./index";
import { HttpError } from "./http";
import { photonResults } from "../../../src/lib/trip-route";

export async function searchPlaces(env: Env, input: Record<string, unknown>) {
  if (
    typeof input.query !== "string" ||
    input.query.trim().length < 2 ||
    input.query.length > 160
  )
    throw new HttpError(400, "请输入 2–160 个字符的酒店、景点或地名");
  const query = input.query.trim();
  const base = env.PHOTON_API_URL || "https://photon.komoot.io/api/";
  if (base === "disabled")
    throw new HttpError(503, "地点检索已关闭，仍可拖动图钉或输入坐标");
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new HttpError(503, "地点服务配置不正确");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url.href),
  );
  const key = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const now = Date.now();
  const cache = await env.DB.prepare(
    "SELECT results_json FROM place_search_cache WHERE key=? AND expires_at>?",
  )
    .bind(key, now)
    .first<{ results_json: string }>();
  if (cache) return { results: JSON.parse(cache.results_json), cached: true };
  const claim = await env.DB.prepare(
    "INSERT INTO service_limits(key,next_at) VALUES('place-search',?) ON CONFLICT(key) DO UPDATE SET next_at=excluded.next_at WHERE service_limits.next_at<=?",
  )
    .bind(now + 1200, now)
    .run();
  if (!claim.meta.changes)
    throw new HttpError(409, "请稍等一秒再搜索；免费服务已限速");
  let results;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "LandingW-Travel/1.0 (+https://landingw.github.io/travel/)",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "manual",
    });
    if (!response.ok) throw new Error("upstream unavailable");
    results = photonResults(await response.json());
  } catch {
    throw new HttpError(
      503,
      "免费地点搜索暂时不可用，请稍后重试；可以直接在地图上选点",
    );
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM place_search_cache WHERE expires_at<=?").bind(
      now,
    ),
    env.DB.prepare(
      "INSERT OR REPLACE INTO place_search_cache(key,results_json,expires_at) VALUES(?,?,?)",
    ).bind(key, JSON.stringify(results), now + 7 * 86400_000),
  ]);
  return { results, cached: false };
}
