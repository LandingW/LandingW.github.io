import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { albumInput, parseManifest, type TravelPhoto } from "../src/lib/travel";
import {
  photosForTrip,
  type LibraryState,
  type ManagedPhoto,
} from "../src/lib/photo-library";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PhotoLibrary from "../src/components/travel/PhotoLibrary";

test("one stored photo can appear in different trips without duplicate membership or inherited equipment", () => {
  const a = {
    id: "a",
    ...albumInput({ title: "A", equipmentDefaults: { lens: "Lens A" } }),
    published: 1,
  };
  const b = {
    id: "b",
    ...albumInput({ title: "B", equipmentDefaults: { lens: "Lens B" } }),
    published: 1,
  };
  const p = {
    id: "p",
    album_id: "a",
    state: "ready",
    published: 1,
    equipment: {},
    rawCamera: null,
    camera: { lens: "Lens A" },
  } as ManagedPhoto;
  const state: LibraryState = {
    albums: [a, b],
    photos: [p],
    memberships: [
      { album_id: "a", photo_id: "p", position: 0, published: 1 },
      { album_id: "b", photo_id: "p", position: 0, published: 0 },
    ],
    usedBytes: 3,
    maxBytes: 100,
  };
  assert.equal(photosForTrip(state, b)[0].camera?.lens, "Lens B");
  assert.equal(photosForTrip(state, b)[0].published, 0);
  assert.equal(photosForTrip(state, a)[0].published, 1);
  assert.equal(
    photosForTrip({ ...state, photos: [{ ...p, deleted_at: "now" }] }, b)
      .length,
    0,
  );
  const photo: TravelPhoto = {
    id: "p",
    albumId: "a",
    caption: "",
    width: 100,
    height: 100,
    thumbnail: "photos/p/v1/thumbnail.jpg",
    preview: "photos/p/v1/preview.jpg",
    dzi: "photos/p/v1/image.dzi",
  };
  const manifest = {
    version: 1,
    albums: [a, b],
    photos: [photo, { ...photo, albumId: "b" }],
  };
  assert.equal(parseManifest(manifest).photos.length, 2);
  assert.throws(
    () => parseManifest({ ...manifest, photos: [photo, photo] }),
    /重复/,
  );
});

test("library renders separate folder, upload and trash actions without exposing credentials", () => {
  const state: LibraryState = {
    albums: [],
    photos: [],
    folders: [],
    memberships: [],
    usedBytes: 0,
    maxBytes: 2e9,
    libraryVersion: 1,
  };
  const props = {
    state,
    config: {
      apiUrl: "https://api.example.com",
      mediaUrl: "https://media.example.com",
    },
    token: "not-in-markup",
    onRefresh: async () => state,
    onBusyChange: () => {},
    onAttached: () => {},
  };
  const html = renderToStaticMarkup(createElement(PhotoLibrary, props));
  assert.match(html, /新建文件夹/);
  assert.match(html, /上传到/);
  assert.match(html, /处理待办/);
  assert.doesNotMatch(html, /not-in-markup/);
  const trash = renderToStaticMarkup(
    createElement(PhotoLibrary, { ...props, trash: true }),
  );
  assert.match(trash, /恢复不会自动重新发布/);
  assert.doesNotMatch(trash, /type="file"/);
});

test("manager confirmations use accessible in-page dialogs instead of blocking native confirm", async () => {
  const dialog = await fs.readFile(
    "src/components/travel/ConfirmAction.tsx",
    "utf8",
  );
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /aria-labelledby/);
  assert.match(dialog, /aria-describedby/);
  assert.match(dialog, /onCancel/);
  assert.match(dialog, /previous\?\.focus/);
  for (const file of ["PhotoLibrary.tsx", "TravelManager.tsx"]) {
    const source = await fs.readFile(`src/components/travel/${file}`, "utf8");
    assert.doesNotMatch(source, /window\.confirm\s*\(/);
    assert.match(source, /<ConfirmAction/);
  }
});

test(
  "library migration, memberships, recovery and bounded R2 purging preserve unrelated assets",
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
    const admin = "local-test-admin",
      processor = "local-test-processor".padEnd(48, "x");
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
          R2_ACCESS_KEY_ID: "test-access",
          R2_SECRET_ACCESS_KEY: "test-secret",
          ADMIN_TOKEN: admin,
          PROCESSOR_TOKEN: processor,
        },
      }),
    );
    try {
      const db = await mf.getD1Database("DB"),
        originals = await mf.getR2Bucket("ORIGINALS"),
        publicBucket = await mf.getR2Bucket("PUBLIC");
      const migrations = (await fs.readdir("workers/photos/migrations"))
        .filter((name) => name.endsWith(".sql"))
        .sort();
      const apply = async (name: string) => {
        const sql = await fs.readFile(
          `workers/photos/migrations/${name}`,
          "utf8",
        );
        await db.batch(
          sql
            .split(";")
            .filter((s) => s.trim())
            .map((s) => db.prepare(s)),
        );
      };
      for (const name of migrations.filter((name) => name < "0006"))
        await apply(name);
      await db
        .prepare(
          "INSERT INTO albums(id,title,published,cover_photo_ids,equipment_json,created_at) VALUES('a','Existing trip',1,'[\"p\"]','{\"lens\":\"Lens A\"}','2026-01-01')",
        )
        .run();
      await db
        .prepare(
          "INSERT INTO photos(id,album_id,original_key,filename,mime,bytes,fingerprint,state,published,width,height,revision,created_at,updated_at,metadata_state) VALUES('p','a','originals/p/source','p.jpg','image/jpeg',3,'hash','ready',1,100,100,'v1','2026-01-01','2026-01-01','ready')",
        )
        .run();
      await originals.put("originals/p/source", "abc");
      for (const name of ["image.dzi", "thumbnail.jpg", "preview.jpg"])
        await publicBucket.put(`photos/p/v1/${name}`, "test");
      await apply("0006_photo_library.sql");
      async function request(path: string, data?: unknown, token = admin) {
        return mf.dispatchFetch(`https://photos.example.com${path}`, {
          method: data === undefined ? "GET" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: data === undefined ? undefined : JSON.stringify(data),
        });
      }
      async function ok(path: string, data: unknown = {}) {
        const response = await request(path, data);
        assert.equal(response.status, 200, `${path}: ${response.status}`);
        return response.json() as Promise<Record<string, unknown>>;
      }
      const state = async () =>
        (await (await request("/admin/state")).json()) as LibraryState;
      const manifest = async () =>
        parseManifest(
          JSON.parse(await (await publicBucket.get("manifest.json"))!.text()),
        );
      assert.equal(
        (
          await request(
            "/admin/library/photos/trash",
            { photoIds: ["p"] },
            "wrong",
          )
        ).status,
        401,
      );
      const migrated = await state();
      assert.equal(migrated.albums.length, 1);
      assert.equal(migrated.folders?.[0].name, "Existing trip");
      assert.equal(migrated.photos[0].folder_id, "a");
      assert.equal(migrated.memberships?.[0].published, 1);
      await ok("/admin/albums/a/publish");
      assert.equal((await manifest()).photos[0].dzi, "photos/p/v1/image.dzi");
      const folder = await ok("/admin/library/folders", { name: "Norway" });
      await ok("/admin/library/photos/move", {
        photoIds: ["p"],
        folderId: folder.id,
      });
      assert.equal((await state()).photos[0].revision, "v1");
      assert.ok(await originals.get("originals/p/source"));
      assert.equal(
        (await request(`/admin/library/folders/${folder.id}/delete`, {}))
          .status,
        409,
      );
      assert.equal(
        (
          await request("/admin/library/photos/move", {
            photoIds: ["p"],
            folderId: "bad",
          })
        ).status,
        404,
      );
      assert.equal(
        (await request("/admin/library/photos/trash", { photoIds: ["p", "p"] }))
          .status,
        400,
      );
      assert.equal(
        (
          await request("/admin/library/photos/trash", {
            photoIds: Array.from(
              { length: 41 },
              (_, index) => `limit-${index}`,
            ),
          })
        ).status,
        400,
      );
      await db
        .prepare(
          "INSERT INTO photos(id,album_id,original_key,filename,mime,bytes,fingerprint,state,width,height,revision,created_at,updated_at) VALUES('q','a','originals/q/source','q.jpg','image/jpeg',1,'hash-q','ready',100,100,'v1','2026-01-02','2026-01-02')",
        )
        .run();
      await ok("/admin/albums/a/photos/add", { photoIds: ["q"] });
      assert.equal((await manifest()).photos.length, 1);
      assert.equal(
        (await request("/admin/albums/a/photos/reorder", { photoIds: ["p"] }))
          .status,
        409,
      );
      await ok("/admin/albums/a/photos/reorder", { photoIds: ["q", "p"] });
      assert.equal(
        (await manifest()).photos.length,
        1,
        "sorting must not publish a draft photo",
      );
      assert.deepEqual(
        (await state()).memberships?.map((link) => link.photo_id),
        ["q", "p"],
      );
      await ok("/admin/albums/a/publish");
      assert.deepEqual(
        (await manifest()).photos.map((photo) => photo.id),
        ["q", "p"],
      );
      await ok("/admin/albums/a/photos/remove", { photoIds: ["q"] });
      await db.prepare("DELETE FROM photos WHERE id='q'").run();
      const created = await request("/admin/albums", {
        title: "Second trip",
        equipmentDefaults: { lens: "Lens B" },
      });
      assert.equal(created.status, 201);
      const second = ((await created.json()) as { id: string }).id;
      await ok(`/admin/albums/${second}/photos/add`, { photoIds: ["p"] });
      await ok(`/admin/albums/${second}/photos/add`, { photoIds: ["p"] });
      assert.equal((await state()).memberships?.length, 2);
      assert.equal(
        (await manifest()).photos.length,
        1,
        "adding never automatically publishes",
      );
      await ok(`/admin/albums/${second}/publish`);
      const shared = await manifest();
      assert.equal(shared.photos.length, 2);
      assert.equal(
        shared.photos.find((p) => p.albumId === second)?.camera?.lens,
        "Lens B",
      );
      assert.equal(
        shared.photos.find((p) => p.albumId === "a")?.camera?.lens,
        "Lens A",
      );
      await ok(`/admin/albums/${second}/edit`, {
        title: "Second trip",
        coverPhotoIds: ["p"],
      });
      await ok(`/admin/albums/${second}/photos/remove`, { photoIds: ["p"] });
      assert.equal((await manifest()).photos.length, 1);
      assert.ok(await publicBucket.get("photos/p/v1/image.dzi"));
      assert.deepEqual(
        (await state()).albums.find((a) => a.id === second)?.coverPhotoIds,
        [],
      );
      await ok("/admin/albums/a/trash");
      assert.equal((await manifest()).photos.length, 0);
      assert.equal((await state()).photos[0].deleted_at, null);
      assert.equal((await request("/admin/albums/a/publish", {})).status, 404);
      await ok("/admin/albums/a/restore");
      assert.equal(
        (await state()).albums.find((a) => a.id === "a")?.published,
        0,
      );
      await ok("/admin/albums/a/publish");
      await ok("/admin/library/photos/trash", { photoIds: ["p"] });
      assert.equal((await manifest()).photos.length, 0);
      assert.equal((await state()).usedBytes, 3);
      assert.equal(
        (
          await request(`/admin/albums/${second}/photos/add`, {
            photoIds: ["p"],
          })
        ).status,
        409,
      );
      await ok("/admin/library/photos/restore", { photoIds: ["p"] });
      assert.equal((await manifest()).photos.length, 0);
      await ok("/admin/albums/a/publish");
      assert.equal((await manifest()).photos.length, 1);
      assert.equal(
        (await request("/admin/library/photos/p/purge", { confirm: "p" }))
          .status,
        409,
      );
      await ok("/admin/library/photos/trash", { photoIds: ["p"] });
      assert.equal(
        (await request("/admin/library/photos/p/purge", { confirm: "other" }))
          .status,
        400,
      );
      await publicBucket.put("photos/other/v1/image.dzi", "keep");
      await originals.put("originals/other/source", "keep");
      await db
        .prepare(
          "UPDATE photos SET original_key='originals/other/source' WHERE id='p'",
        )
        .run();
      assert.equal(
        (await request("/admin/library/photos/p/purge", { confirm: "p" }))
          .status,
        409,
      );
      assert.ok(await originals.get("originals/other/source"));
      assert.ok(await publicBucket.get("photos/p/v1/image.dzi"));
      await db
        .prepare(
          "UPDATE photos SET original_key='originals/p/source' WHERE id='p'",
        )
        .run();
      for (let i = 0; i < 405; i++)
        await publicBucket.put(
          `photos/p/old/image_files/0/${i}_0.jpeg`,
          "tile",
        );
      const first = await ok("/admin/library/photos/p/purge", { confirm: "p" });
      assert.equal(first.done, false);
      assert.equal(
        (await request("/admin/library/photos/restore", { photoIds: ["p"] }))
          .status,
        409,
      );
      assert.equal(
        (await ok("/admin/library/photos/p/purge", { confirm: "p" })).done,
        true,
      );
      assert.equal(
        (await ok("/admin/library/photos/p/purge", { confirm: "p" })).done,
        true,
      );
      assert.equal(
        (await publicBucket.list({ prefix: "photos/p/" })).objects.length,
        0,
      );
      assert.equal(await originals.get("originals/p/source"), null);
      assert.ok(await publicBucket.get("photos/other/v1/image.dzi"));
      assert.ok(await originals.get("originals/other/source"));
      assert.equal((await state()).usedBytes, 0);
      await ok(`/admin/library/folders/${folder.id}/delete`);
      const upload = await request("/admin/uploads/start", {
        filename: "library.jpg",
        mime: "image/jpeg",
        bytes: 10,
        fingerprint: "f".repeat(64),
      });
      assert.equal(upload.status, 201);
      const newId = ((await upload.json()) as { id: string }).id;
      assert.equal((await state()).photos[0].album_id, "photo-library");
      assert.equal((await state()).memberships?.length, 0);
      assert.equal(
        (await request("/admin/library/photos/trash", { photoIds: [newId] }))
          .status,
        409,
      );
      await db
        .prepare("UPDATE photos SET state='queued' WHERE id=?")
        .bind(newId)
        .run();
      await ok("/admin/library/photos/trash", { photoIds: [newId] });
      const claim = await request("/internal/claim", {}, processor);
      assert.equal(((await claim.json()) as { job: unknown }).job, null);
    } finally {
      await mf.dispose();
    }
  },
);
