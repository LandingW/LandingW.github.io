// Loopback-only UI fixture. Reads published media; every edit stays in memory.
// node tests/fixtures/travel-ui-server.mjs (after npm run build)
import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
const root = await realpath("out");
const config = JSON.parse(await readFile("public/travel-config.json", "utf8"));
const manifest = await (await fetch(`${config.mediaUrl}/manifest.json`)).json();
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
}));
const token = `Basic ${Buffer.from("admin:local-preview-only").toString("base64")}`;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
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
    const route =
      url.searchParams.get("page") === "home"
        ? "/"
        : url.searchParams.get("page") === "map"
          ? "/travel/"
          : "/travel/?trip=48e497df-f629-4026-873c-973472f6ceb6";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<html><body style="margin:0;background:#ddd"><iframe id="mobile-preview" title="${width}px responsive preview" src="${route}" style="display:block;border:0;width:${width}px;height:844px"></iframe></body></html>`,
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
