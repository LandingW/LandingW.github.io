import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test(
  "photo service enforces authentication, quota, private originals and explicit publication",
  { timeout: 90000 },
  async () => {
    const code = await build({
      entryPoints: ["workers/photos/src/index.ts"],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      target: "es2022",
    });
    const adminToken = "test-admin-a",
      processorToken = "test-processor-".padEnd(48, "b");
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: code.outputFiles[0].text,
        compatibilityDate: "2026-10-10",
        d1Databases: ["DB"],
        r2Buckets: ["ORIGINALS", "PUBLIC"],
        bindings: {
          ALLOWED_ORIGINS: "https://landingw.github.io",
          PUBLIC_MEDIA_URL: "https://media.example.com",
          R2_ACCOUNT_ID: "a".repeat(32),
          R2_ORIGINALS_BUCKET: "originals",
          MAX_ORIGINAL_BYTES: "10000000",
          R2_ACCESS_KEY_ID: "test-access-key",
          R2_SECRET_ACCESS_KEY: "test-secret-key",
          ADMIN_TOKEN: adminToken,
          PROCESSOR_TOKEN: processorToken,
          GITHUB_REPOSITORY: "LandingW/LandingW.github.io",
        },
      }),
    );
    try {
      const db = await mf.getD1Database("DB"),
        originals = await mf.getR2Bucket("ORIGINALS"),
        published = await mf.getR2Bucket("PUBLIC");
      const migrations = await fs.readdir("workers/photos/migrations");
      const migration = (
        await Promise.all(
          migrations
            .filter((name) => name.endsWith(".sql"))
            .sort()
            .map((name) =>
              fs.readFile(`workers/photos/migrations/${name}`, "utf8"),
            ),
        )
      ).join("\n");
      await db.batch(
        migration
          .split(";")
          .filter((sql) => sql.trim())
          .map((sql) => db.prepare(sql)),
      );
      async function request(
        url: string,
        data?: unknown,
        token = adminToken,
        origin = "https://landingw.github.io",
        ip = "203.0.113.10",
      ) {
        return mf.dispatchFetch(`https://photos.example.com${url}`, {
          method: data === undefined ? "GET" : "POST",
          headers: {
            Origin: origin,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "CF-Connecting-IP": ip,
          },
          body: data === undefined ? undefined : JSON.stringify(data),
        });
      }
      assert.equal(
        (await request("/admin/state", undefined, "wrong")).status,
        401,
      );
      assert.equal(
        (
          await request(
            "/admin/state",
            undefined,
            adminToken,
            "https://evil.example.com",
          )
        ).status,
        403,
      );
      const created = await request("/admin/albums", {
        title: "测试旅行",
        place: "只公开手动地点",
        latitude: 0,
        longitude: 0,
      });
      assert.equal(created.status, 201);
      const { id: albumId } = (await created.json()) as { id: string };
      const fingerprint = "f".repeat(64);
      const start = () =>
        request("/admin/uploads/start", {
          albumId,
          filename: "private-test.jpg",
          mime: "image/jpeg",
          bytes: 6_000_000,
          fingerprint,
        });
      const parallel = await Promise.all([start(), start()]);
      assert.deepEqual(
        parallel.map((response) => response.status).sort(),
        [201, 413],
      );
      const first = (await parallel
        .find((response) => response.status === 201)!
        .json()) as { id: string; parts: { url: string }[] };
      assert.match(first.parts[0].url, /X-Amz-Signature=/);
      assert.equal(
        (
          await request(`/admin/uploads/${first.id}/resume`, {
            fingerprint: "0".repeat(64),
          })
        ).status,
        409,
      );
      assert.equal(
        (await request(`/admin/uploads/${first.id}/abort`, {})).status,
        200,
      );
      const next = await request("/admin/uploads/start", {
        albumId,
        filename: "private-test.jpg",
        mime: "image/jpeg",
        bytes: 100,
        fingerprint,
      });
      const { id } = (await next.json()) as { id: string };
      const row = await db
        .prepare("SELECT * FROM photos WHERE id=?")
        .bind(id)
        .first<{ original_key: string; upload_id: string }>();
      const part = await originals
        .resumeMultipartUpload(row!.original_key, row!.upload_id)
        .uploadPart(1, new Uint8Array(100));
      assert.equal(
        (await request(`/admin/uploads/${id}/complete`, { parts: [part] }))
          .status,
        200,
      );
      const resumed = await request(`/admin/uploads/${id}/resume`, {
        fingerprint,
      });
      assert.equal(
        ((await resumed.json()) as { completed: boolean }).completed,
        true,
      );
      assert.equal(await published.get("manifest.json"), null);
      const noMatch = await request(
        "/internal/claim",
        { photoId: "not-this-photo" },
        processorToken,
      );
      assert.equal(((await noMatch.json()) as { job: unknown }).job, null);
      assert.equal(
        (
          await request(
            "/internal/claim",
            { photoId: "../outside" },
            processorToken,
          )
        ).status,
        400,
      );
      const jobs = await Promise.all([
        request("/internal/claim", {}, processorToken),
        request("/internal/claim", {}, processorToken),
      ]);
      const claimed = await Promise.all(
        jobs.map(
          async (result) =>
            (await result.json()) as {
              job: { id: string; prefix: string; lease: string } | null;
            },
        ),
      );
      assert.equal(claimed.filter((result) => result.job).length, 1);
      const job = claimed.find((result) => result.job)!.job!;
      const result = {
        lease: job.lease,
        width: 100,
        height: 100,
        tileCount: 8,
        derivedBytes: 1200,
      };
      assert.equal(
        (
          await request(
            `/internal/photos/${id}/complete`,
            result,
            processorToken,
          )
        ).status,
        409,
      );
      for (const name of ["image.dzi", "preview.jpg", "thumbnail.jpg"])
        await published.put(job.prefix + name, "test derivative");
      assert.equal(
        (
          await request(
            `/internal/photos/${id}/complete`,
            { ...result, lease: "wrong" },
            processorToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            `/internal/photos/${id}/complete`,
            result,
            processorToken,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            `/internal/photos/${id}/complete`,
            result,
            processorToken,
          )
        ).status,
        200,
      );
      assert.equal(await published.get("manifest.json"), null);
      assert.equal(
        (await request(`/admin/albums/${albumId}/publish`, {})).status,
        200,
      );
      const manifest = await (await published.get("manifest.json"))!.text();
      const data = JSON.parse(manifest);
      assert.equal(data.albums.length, 1);
      assert.equal(data.photos.length, 1);
      assert.equal(data.albums[0].latitude, 0);
      assert.doesNotMatch(
        manifest,
        /originals|private-test|fingerprint|sourceUrl|lease|upload_id|X-Amz/,
      );
      assert.equal(
        (await request(`/admin/albums/${albumId}/unpublish`, {})).status,
        200,
      );
      assert.equal(
        JSON.parse(await (await published.get("manifest.json"))!.text()).photos
          .length,
        0,
      );
      assert.ok(await originals.get(row!.original_key));
      assert.equal((await request("/admin/process", {})).status, 503);
      const burst = await Promise.all(
        Array.from({ length: 12 }, () =>
          request(
            "/admin/state",
            undefined,
            "wrong",
            "https://landingw.github.io",
            "203.0.113.20",
          ),
        ),
      );
      assert.equal(
        burst.filter((response) => response.status === 401).length,
        5,
      );
      assert.equal(
        burst.filter((response) => response.status === 429).length,
        7,
      );
      const locked = await request(
        "/admin/state",
        undefined,
        adminToken,
        "https://landingw.github.io",
        "203.0.113.20",
      );
      assert.equal(locked.status, 429);
      assert.equal(locked.headers.get("Retry-After"), "900");
      assert.equal(
        (
          await request(
            "/admin/state",
            undefined,
            adminToken,
            "https://landingw.github.io",
            "203.0.113.30",
          )
        ).status,
        200,
      );
      const attempts = await db
        .prepare("SELECT * FROM admin_login_limits")
        .all();
      assert.doesNotMatch(
        JSON.stringify(attempts.results),
        /203\.0\.113|test-admin/,
      );
      await db.prepare("UPDATE admin_login_limits SET expires_at=0").run();
      assert.equal(
        (
          await request(
            "/admin/state",
            undefined,
            adminToken,
            "https://landingw.github.io",
            "203.0.113.20",
          )
        ).status,
        200,
      );
      assert.equal(
        (await db.prepare("SELECT * FROM admin_login_limits").all()).results
          .length,
        0,
      );
    } finally {
      await mf.dispose();
    }
  },
);
