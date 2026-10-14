// Loopback-only UI fixture. Reads published media; every edit stays in memory.
// node tests/fixtures/travel-ui-server.mjs (after npm run build)
import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
const root = await realpath("out");
const config = JSON.parse(await readFile("public/travel-config.json", "utf8"));
const manifest = await (await fetch(`${config.mediaUrl}/manifest.json`)).json();
if (process.env.PHOTO_UI_ROUTE_FIXTURE === "1" && manifest.albums[0]) {
  manifest.albums[0].stops = [
    {
      id: "local-stay",
      name: "本机样例 · 海边酒店",
      kind: "stay",
      note: "仅本机路线验证，不保存到云端。",
      latitude: 69.632,
      longitude: 17.994,
    },
    {
      id: "local-view",
      name: "本机样例 · 海岸观景点",
      kind: "sight",
      note: "第二站",
      latitude: 69.612,
      longitude: 18.04,
    },
    {
      id: "local-harbor",
      name: "本机样例 · 码头",
      kind: "transit",
      note: "第三站",
      latitude: 69.655,
      longitude: 18.13,
    },
  ];
}
// Synthetic GPS for exercising detail-map linking; never written to the service.
if (process.env.PHOTO_UI_DETAIL_FIXTURE === "1") {
  const target = manifest.albums.find((album) => album.latitude !== null);
  if (target) {
    const samples = manifest.photos.filter(
      (photo) => photo.albumId === target.id,
    );
    samples.slice(0, 3).forEach((photo, index) => {
      photo.caption = `仅本机测试 · 点位 ${index + 1}`;
      photo.location = {
        latitude: target.latitude + (index < 2 ? 0.015 : -0.02),
        longitude: target.longitude + (index < 2 ? 0.035 : -0.03),
      };
    });
  }
}
// Explicit opt-in sample coordinates for pin/preview tests; never user travel data.
if (process.env.PHOTO_UI_MAP_FIXTURE === "1") {
  manifest.albums = manifest.albums.map((album, i) => ({
    ...album,
    title: `本机图钉样例 ${i + 1}`,
    place: "仅用于本机地图测试",
    latitude: i ? 36 : 50,
    longitude: i ? 105 : -95,
    googlePlaceId: null,
  }));
}
const albums = manifest.albums.map((album, i) => ({
  ...album,
  title: `本机测试 ${i + 1} · 不保存到云端`,
  equipmentDefaults: {},
  published: 0,
}));
const photos = manifest.photos.map((photo, i) => ({
  ...photo,
  album_id: photo.albumId,
  filename: `测试照片-${i + 1}.jpg`,
  bytes: 10000000,
  state: "ready",
  published: 0,
  derived_bytes: 1000000,
  gps: photo.location,
  location_mode: "exact",
  metadata_state: "ready",
  metadata_error: null,
  created_at: String(i).padStart(3, "0"),
  equipment: {},
  rawCamera: photo.camera,
  folder_id: photo.albumId,
  deleted_at: null,
  revision: photo.thumbnail.split("/")[2],
}));
const folders = albums.map((album) => ({
  id: album.id,
  name: album.title,
  created_at: "2026-10-12",
}));
const memberships = photos.map((photo, position) => ({
  album_id: photo.album_id,
  photo_id: photo.id,
  position,
  published: 0,
}));
const token = `Basic ${Buffer.from("admin:local-preview-only").toString("base64")}`;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3003");
  if (url.pathname === "/__responsive") {
    const width = Math.max(
      320,
      Math.min(1280, Number(url.searchParams.get("width")) || 390),
    );
    const height = Math.max(
      320,
      Math.min(1000, Number(url.searchParams.get("height")) || 720),
    );
    const route =
      url.searchParams.get("page") === "home"
        ? "/"
        : url.searchParams.get("page") === "map"
          ? "/travel/"
          : "/travel/?trip=48e497df-f629-4026-873c-973472f6ceb6";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<html><body style="margin:0;background:#ddd;overflow:hidden"><iframe id="mobile-preview" title="${width}px responsive preview" src="${route}" style="display:block;border:0;width:${width}px;height:${height}px;max-height:100dvh"></iframe></body></html>`,
    );
    return;
  }
  const json = (data, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/travel-config.json")
    return json({
      ...config,
      apiUrl: "http://127.0.0.1:3003",
      mediaUrl: "http://127.0.0.1:3003/media",
    });
  if (url.pathname === "/media/manifest.json") return json(manifest);
  if (url.pathname === "/media/maps-config.json") return json({}, 404);
  if (
    /^\/media\/photos\/[\w-]+\/[\w-]+\/(?:thumbnail\.jpg|preview\.jpg|image\.dzi|image_files\/\d+\/\d+_\d+\.jpeg)$/.test(
      url.pathname,
    )
  ) {
    const upstream = await fetch(config.mediaUrl + url.pathname.slice(6));
    res.writeHead(upstream.status, {
      "Content-Type":
        upstream.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(Buffer.from(await upstream.arrayBuffer()));
    return;
  }
  if (url.pathname.startsWith("/admin/")) {
    if (req.headers.authorization !== token)
      return json({ error: "仅限本机测试密码 local-preview-only" }, 401);
    if (url.pathname === "/admin/state" && req.method === "GET")
      return json({
        albums,
        photos,
        folders,
        memberships,
        libraryVersion: 1,
        routeVersion: 1,
        derivedBytes: photos.reduce(
          (sum, photo) => sum + photo.derived_bytes,
          0,
        ),
        usedBytes: 130000000,
        maxBytes: 2000000000,
      });
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 10000) return json({ error: "请求太大" }, 413);
    }
    try {
      const data = JSON.parse(raw || "{}");
      if (url.pathname === "/admin/places/search")
        return json({
          results: [
            {
              id: "local-result",
              name: "本机检索样例 · 酒店",
              address: "仅用于 UI 测试，不来自线上地名服务",
              kind: "stay",
              latitude: 69.636,
              longitude: 18.035,
            },
          ],
        });
      // Library mutations below affect these in-memory copies only; no R2 calls.
      if (url.pathname === "/admin/library/folders") {
        const id = `local-folder-${Date.now()}`;
        folders.push({
          id,
          name: data.name,
          created_at: new Date().toISOString(),
        });
        return json({ id });
      }
      const folderAction = url.pathname.match(
        /^\/admin\/library\/folders\/([\w-]+)\/(rename|delete)$/,
      );
      if (folderAction) {
        const folder = folders.find((item) => item.id === folderAction[1]);
        if (!folder) return json({ error: "文件夹不存在" }, 404);
        if (folderAction[2] === "rename") folder.name = data.name;
        else {
          if (photos.some((photo) => photo.folder_id === folder.id))
            return json({ error: "文件夹仍有照片" }, 409);
          folders.splice(folders.indexOf(folder), 1);
        }
        return json({ ok: true });
      }
      const libraryAction = url.pathname.match(
        /^\/admin\/library\/photos\/(move|trash|restore)$/,
      );
      if (libraryAction) {
        for (const photo of photos.filter((item) =>
          data.photoIds.includes(item.id),
        )) {
          if (libraryAction[1] === "move") photo.folder_id = data.folderId;
          else {
            photo.deleted_at =
              libraryAction[1] === "trash" ? new Date().toISOString() : null;
            if (photo.deleted_at)
              memberships
                .filter((link) => link.photo_id === photo.id)
                .forEach((link) => (link.published = 0));
          }
        }
        return json({ ok: true });
      }
      const purge = url.pathname.match(
        /^\/admin\/library\/photos\/([\w-]+)\/purge$/,
      );
      if (purge) {
        const index = photos.findIndex((photo) => photo.id === purge[1]);
        if (index >= 0) {
          if (!photos[index].deleted_at)
            return json({ error: "请先移入回收站" }, 409);
          photos.splice(index, 1);
          for (let i = memberships.length - 1; i >= 0; i--)
            if (memberships[i].photo_id === purge[1]) memberships.splice(i, 1);
        }
        return json({ ok: true, done: true });
      }
      const tripAction = url.pathname.match(
        /^\/admin\/albums\/([\w-]+)\/(trash|restore)$/,
      );
      if (tripAction) {
        const album = albums.find((item) => item.id === tripAction[1]);
        album.deleted_at =
          tripAction[2] === "trash" ? new Date().toISOString() : null;
        album.published = 0;
        return json({ ok: true });
      }
      const memberAction = url.pathname.match(
        /^\/admin\/albums\/([\w-]+)\/photos\/(add|remove|reorder)$/,
      );
      if (memberAction) {
        const [, id, action] = memberAction;
        for (const [position, photoId] of data.photoIds.entries()) {
          const index = memberships.findIndex(
            (link) => link.album_id === id && link.photo_id === photoId,
          );
          if (action === "add" && index < 0)
            memberships.push({
              album_id: id,
              photo_id: photoId,
              published: 0,
              position: memberships.length,
            });
          if (action === "remove" && index >= 0) memberships.splice(index, 1);
          if (action === "reorder" && index >= 0)
            memberships[index].position = position;
        }
        if (action === "remove") {
          const album = albums.find((item) => item.id === id);
          album.coverPhotoIds = (album.coverPhotoIds || []).filter(
            (photoId) => !data.photoIds.includes(photoId),
          );
        }
        return json({ ok: true });
      }
      const edit = url.pathname.match(/^\/admin\/albums\/([\w-]+)\/edit$/);
      if (edit) {
        Object.assign(
          albums.find((album) => album.id === edit[1]),
          data,
        );
        return json({ ok: true });
      }
      if (url.pathname === "/admin/albums") {
        const id = `local-${Date.now()}`;
        albums.push({ ...data, id, published: 0 });
        return json({ id });
      }
      const equipment = url.pathname.match(
        /^\/admin\/photos\/([\w-]+)\/equipment$/,
      );
      if (equipment) {
        const photo = photos.find((photo) => photo.id === equipment[1]);
        photo.equipment = data;
        return json({ ok: true });
      }
      return json({ error: "本机 UI 测试不执行上传、发布或云端操作" }, 409);
    } catch {
      return json({ error: "本机测试请求无效" }, 400);
    }
  }
  if (!["GET", "HEAD"].includes(req.method))
    return json({ error: "不支持" }, 405);
  try {
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (file !== root && !file.startsWith(root + path.sep))
      return json({ error: "禁止" }, 403);
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    file = await realpath(file);
    if (!file.startsWith(root + path.sep)) return json({ error: "禁止" }, 403);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(3003, "127.0.0.1", () =>
  console.log(
    "Loopback UI fixture: http://127.0.0.1:3003/travel/manage/ — password: local-preview-only. No cloud writes.",
  ),
);
