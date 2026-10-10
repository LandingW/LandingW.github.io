"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  albumInput,
  formatBytes,
  type TravelAlbum,
  type TravelConfig,
  type TravelPhoto,
} from "@/lib/travel";
import { loadTravelConfig, photoApi, uploadPhoto } from "@/lib/travel-client";
import {
  cameraName,
  type CameraMetadata,
  type PhotoLocation,
} from "@/lib/photo-metadata";
import PhotoFacts from "./PhotoFacts";
import TripCover from "./TripCover";
import { googleMapsLink } from "@/lib/trip-presentation";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });
const GoogleMapView = dynamic(() => import("./GoogleMapView"), { ssr: false });
type Album = TravelAlbum & { published: number };
type Photo = {
  id: string;
  album_id: string;
  filename: string;
  bytes: number;
  state: string;
  error: string | null;
  published: number;
  derived_bytes: number | null;
  camera: CameraMetadata | null;
  gps: PhotoLocation | null;
  location_mode: "exact" | "hidden";
  metadata_state: string;
  metadata_error: string | null;
  width: number | null;
  height: number | null;
  thumbnail?: string | null;
  created_at: string;
};
interface State {
  albums: Album[];
  photos: Photo[];
  usedBytes: number;
  maxBytes: number;
}
const blank = {
  title: "",
  description: "",
  place: "",
  date: "",
  latitude: "",
  longitude: "",
  googlePlaceId: null as string | null,
  coverPhotoIds: [] as string[],
};
const statuses: Record<string, string> = {
  uploading: "上传未完成",
  queued: "等待处理",
  processing: "正在切片",
  ready: "可以发布",
  failed: "处理失败",
};

export default function TravelManager() {
  const [config, setConfig] = useState<TravelConfig | null>(null);
  const [password, setPassword] = useState(""),
    [token, setToken] = useState("");
  const [state, setState] = useState<State | null>(null),
    [selected, setSelected] = useState("");
  const [form, setForm] = useState(blank),
    [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [progress, setProgress] = useState<{
    name: string;
    value: number;
  } | null>(null);
  const [gpsPreview, setGpsPreview] = useState("");
  const [mapsOpen, setMapsOpen] = useState(false);
  const [mapsForm, setMapsForm] = useState({ apiKey: "", mapId: "" });
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    void loadTravelConfig()
      .then((value) => {
        if (alive) {
          setConfig(value);
          setMapsForm({
            apiKey: value.googleMapsApiKey || "",
            mapId: value.googleMapsMapId || "",
          });
        }
      })
      .catch(() => {
        if (alive) setError("无法读取配置，请重新打开页面");
      });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, []);
  const pending = state?.photos.some(
    (photo) =>
      ["queued", "processing"].includes(photo.state) ||
      ["queued", "processing"].includes(photo.metadata_state),
  );
  useEffect(() => {
    if (!token || !config?.apiUrl || !pending) return;
    let alive = true;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void photoApi<State>(config.apiUrl, token, "/admin/state")
        .then((next) => {
          if (alive) setState(next);
        })
        .catch(() => {
          if (alive) setError("状态刷新失败，可以稍后手动刷新");
        });
    }, 10000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [config, token, pending]);
  async function refresh() {
    if (!config) return;
    const next = await photoApi<State>(config.apiUrl, token, "/admin/state");
    setState(next);
    return next;
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作未完成，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  function selectAlbum(id: string) {
    setSelected(id);
    setShowMap(false);
    const album = state?.albums.find((a) => a.id === id);
    setForm(
      album
        ? {
            title: album.title,
            description: album.description,
            place: album.place,
            date: album.date,
            latitude: album.latitude === null ? "" : String(album.latitude),
            longitude: album.longitude === null ? "" : String(album.longitude),
            googlePlaceId: album.googlePlaceId || null,
            coverPhotoIds: album.coverPhotoIds || [],
          }
        : blank,
    );
  }
  function login(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const next = await photoApi<State>(
        config!.apiUrl,
        password,
        "/admin/state",
      );
      setState(next);
      setToken(password);
      setPassword("");
      const requestedTrip = new URLSearchParams(window.location.search).get(
        "trip",
      );
      const requestedAlbum = next.albums.find(
        (album) => album.id === requestedTrip,
      );
      if (requestedAlbum) {
        setSelected(requestedAlbum.id);
        setForm({
          title: requestedAlbum.title,
          description: requestedAlbum.description,
          place: requestedAlbum.place,
          date: requestedAlbum.date,
          latitude:
            requestedAlbum.latitude === null
              ? ""
              : String(requestedAlbum.latitude),
          longitude:
            requestedAlbum.longitude === null
              ? ""
              : String(requestedAlbum.longitude),
          googlePlaceId: requestedAlbum.googlePlaceId || null,
          coverPhotoIds: requestedAlbum.coverPhotoIds || [],
        });
      }
    });
  }
  async function upload(files: FileList | null) {
    if (!files?.length || !selected || busy) return;
    const picked = [...files];
    await run(async () => {
      const controller = new AbortController();
      abort.current = controller;
      try {
        for (const file of picked) {
          setProgress({ name: file.name, value: 0 });
          await uploadPhoto(
            config!.apiUrl,
            token,
            selected,
            file,
            (value) => setProgress({ name: file.name, value }),
            controller.signal,
          );
        }
        setMessage(
          `${picked.length} 张已上传。点击“处理待办照片”开始生成高清切片。`,
        );
      } finally {
        setProgress(null);
        abort.current = null;
        if (fileInput.current) fileInput.current.value = "";
        await refresh();
      }
    });
  }
  const active = state?.albums.find((album) => album.id === selected);
  const previewPhotos: TravelPhoto[] = (state?.photos || [])
    .filter((photo) => photo.state === "ready" && photo.thumbnail)
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    )
    .map((photo) => ({
      id: photo.id,
      albumId: photo.album_id,
      caption: "",
      width: photo.width || 1,
      height: photo.height || 1,
      thumbnail: photo.thumbnail!,
      preview: "",
      dzi: "",
    }));
  function toggleCover(photo: Photo) {
    if (selected !== photo.album_id) selectAlbum(photo.album_id);
    const saved =
      selected === photo.album_id
        ? form.coverPhotoIds
        : state?.albums.find((album) => album.id === photo.album_id)
            ?.coverPhotoIds || [];
    if (!saved.includes(photo.id) && saved.length >= 4) {
      setError("封面最多选四张，请先取消一张。");
      return;
    }
    setForm((old) => ({
      ...old,
      coverPhotoIds: saved.includes(photo.id)
        ? saved.filter((id) => id !== photo.id)
        : [...saved, photo.id],
    }));
    setMessage("封面选择已更新，点击保存旅行信息后生效。");
  }
  return (
    <div className="travel-manager">
      <div className="manager-heading">
        <div>
          <p className="eyebrow">PRIVATE / 影集管理</p>
          <h1>
            记录下一程<span className="accent">.</span>
          </h1>
          <p>上传、确认地点，再发布。无需重新构建网站。</p>
        </div>
        <Link href="/travel/">查看旅行页 ↗</Link>
      </div>
      {error && (
        <p className="manager-notice is-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="manager-notice" role="status">
          {message}
        </p>
      )}
      {!config ? (
        <p role="status">正在读取配置…</p>
      ) : !config.apiUrl || !config.mediaUrl ? (
        <section className="manager-setup">
          <h2>先连接你的照片存储</h2>
          <p>
            页面和上传流程已准备好，还没有连接 Cloudflare
            R2。当前不会上传或公开任何照片。
          </p>
          <ol>
            <li>开通 Cloudflare R2，保持免费 Workers 计划。</li>
            <li>
              按仓库内 docs/PHOTOS-SETUP.md 创建私有原片桶、展示桶和相册数据库。
            </li>
            <li>在服务端填写凭据，连接公开图片地址与上传接口。</li>
          </ol>
          <p>
            不要把存储密钥放进网页、Git
            仓库或聊天。管理口令也只保留在当前页面内存中。
          </p>
        </section>
      ) : !token ? (
        <form className="manager-login" onSubmit={login}>
          <h2>仅供本人使用</h2>
          <label>
            管理密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              minLength={12}
              maxLength={256}
              placeholder="自己设置的密码，至少 12 个字符"
            />
          </label>
          <button className="travel-button" disabled={busy}>
            进入管理
          </button>
          <p>刷新页面后需要重新输入；不会保存到浏览器本地存储。</p>
        </form>
      ) : (
        <>
          <div className="manager-toolbar">
            <span>
              原片 {formatBytes(state?.usedBytes || 0)} /{" "}
              {formatBytes(state?.maxBytes || 2_000_000_000)}
            </span>
            <div>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await refresh();
                  })
                }
              >
                刷新状态
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setToken("");
                  setState(null);
                  setSelected("");
                }}
              >
                退出
              </button>
            </div>
          </div>
          <details
            className="manager-map-settings"
            open={mapsOpen}
            onToggle={(event) => setMapsOpen(event.currentTarget.open)}
          >
            <summary>
              Google 地图服务 ·{" "}
              {config.googleMapsApiKey ? "已配置" : "待配置 API key"}
            </summary>
            <p>
              启用 Maps JavaScript API 和 Places API（New），并将浏览器 key
              限制到本网站。Google
              的账单、配额和费用由你的账号管理，不会自动替你开通。
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const saved = await photoApi<{
                    apiKey: string;
                    mapId: string;
                  }>(config.apiUrl, token, "/admin/maps", mapsForm);
                  setConfig({
                    ...config,
                    googleMapsApiKey: saved.apiKey,
                    googleMapsMapId: saved.mapId,
                  });
                  setMessage(
                    "Google 地图设置已保存，无需构建网站。若更换了已加载的 key，请刷新页面。",
                  );
                });
              }}
            >
              <label>
                受网站限制的 Google Maps 浏览器 API key
                <input
                  type="password"
                  value={mapsForm.apiKey}
                  onChange={(event) =>
                    setMapsForm({ ...mapsForm, apiKey: event.target.value })
                  }
                  placeholder="AIza…"
                  autoComplete="off"
                />
              </label>
              <label>
                Map ID（可选）
                <input
                  value={mapsForm.mapId}
                  onChange={(event) =>
                    setMapsForm({ ...mapsForm, mapId: event.target.value })
                  }
                  placeholder="留空使用 DEMO_MAP_ID；正式使用建议设置自己的 Map ID"
                />
              </label>
              <p className="manager-help">
                此 key 会发给访客浏览器，必须设置 HTTP 网站来源和 API
                限制。不要填写服务账号私钥、R2 或 GitHub 密钥。
              </p>
              <button className="travel-button" disabled={busy}>
                保存地图配置
              </button>
            </form>
          </details>
          <div className="manager-layout">
            <section className="manager-album">
              <div className="manager-section-title">
                <h2>01 / 旅行信息</h2>
                <button disabled={busy} onClick={() => selectAlbum("")}>
                  新建 ＋
                </button>
              </div>
              <label>
                选择旅行
                <select
                  value={selected}
                  disabled={busy}
                  onChange={(event) => selectAlbum(event.target.value)}
                >
                  <option value="">新建一次旅行</option>
                  {state?.albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.title}
                      {album.published ? " · 已发布" : " · 草稿"}
                    </option>
                  ))}
                </select>
              </label>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const data = albumInput(form);
                    if (selected)
                      await photoApi(
                        config.apiUrl,
                        token,
                        `/admin/albums/${selected}/edit`,
                        data,
                      );
                    else {
                      const created = await photoApi<{ id: string }>(
                        config.apiUrl,
                        token,
                        "/admin/albums",
                        data,
                      );
                      setSelected(created.id);
                    }
                    await refresh();
                    setMessage("旅行信息已保存，可以继续上传照片。");
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    标题
                    <input
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      maxLength={100}
                      required
                      placeholder="这次旅行的名字"
                    />
                  </label>
                  <div className="manager-fields">
                    <label>
                      日期
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) =>
                          setForm({ ...form, date: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      地点标签（自己标注）
                      <input
                        value={form.place}
                        onChange={(e) =>
                          setForm({ ...form, place: e.target.value })
                        }
                        maxLength={120}
                        placeholder="城市或景点即可"
                      />
                    </label>
                  </div>
                  <label>
                    简短记录
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      maxLength={1200}
                    />
                  </label>
                  <div className="manager-fields">
                    <label>
                      纬度
                      <input
                        type="number"
                        disabled={Boolean(form.googlePlaceId)}
                        min={-90}
                        max={90}
                        step="any"
                        value={form.latitude}
                        onChange={(e) =>
                          setForm({ ...form, latitude: e.target.value })
                        }
                        placeholder="可留空"
                      />
                    </label>
                    <label>
                      经度
                      <input
                        type="number"
                        disabled={Boolean(form.googlePlaceId)}
                        min={-180}
                        max={180}
                        step="any"
                        value={form.longitude}
                        onChange={(e) =>
                          setForm({ ...form, longitude: e.target.value })
                        }
                        placeholder="可留空"
                      />
                    </label>
                  </div>
                  <p className="manager-help">
                    每次旅行一个标记：优先使用你选择的旅行地点，否则取首张公开
                    GPS 照片的位置。选择 Google 地点时不必手填坐标。
                  </p>
                  <div className="manager-actions">
                    <button type="button" onClick={() => setShowMap(!showMap)}>
                      {showMap ? "收起选点地图" : "在 Google 地图选择地点"}
                    </button>
                    {form.place && (
                      <a
                        href={googleMapsLink(
                          form.place,
                          null,
                          form.googlePlaceId,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        打开 Google 地图 ↗
                      </a>
                    )}
                  </div>
                  {form.googlePlaceId && (
                    <p className="manager-help">
                      已保存一个 Google 地点。
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, googlePlaceId: null })
                        }
                      >
                        清除地点关联，改用手动标记
                      </button>
                    </p>
                  )}
                  {showMap && config.googleMapsApiKey ? (
                    <GoogleMapView
                      apiKey={config.googleMapsApiKey}
                      mapId={config.googleMapsMapId}
                      pins={[
                        {
                          id: "trip",
                          label: form.title || "旅行地点",
                          googlePlaceId: form.googlePlaceId,
                          location:
                            form.latitude !== "" && form.longitude !== ""
                              ? {
                                  latitude: Number(form.latitude),
                                  longitude: Number(form.longitude),
                                }
                              : null,
                        },
                      ]}
                      selected="trip"
                      onPick={(value) =>
                        setForm((old) => ({
                          ...old,
                          googlePlaceId: value.googlePlaceId,
                          latitude: value.googlePlaceId
                            ? ""
                            : value.location.latitude.toFixed(6),
                          longitude: value.googlePlaceId
                            ? ""
                            : value.location.longitude.toFixed(6),
                        }))
                      }
                    />
                  ) : (
                    showMap && (
                      <div className="map-picker-fallback">
                        <p className="manager-help">
                          Google 地图尚未配置。
                          <button
                            type="button"
                            onClick={() => setMapsOpen(true)}
                          >
                            配置 API key
                          </button>{" "}
                          后可直接搜索景点；现在也可使用临时手动选点。
                        </p>
                        <LocationMap
                          latitude={Number(form.latitude) || 0}
                          longitude={Number(form.longitude) || 0}
                          place={form.place}
                          googlePlaceId={form.googlePlaceId}
                          onPick={(latitude, longitude) =>
                            setForm((old) => ({
                              ...old,
                              latitude: latitude.toFixed(5),
                              longitude: longitude.toFixed(5),
                              googlePlaceId: null,
                            }))
                          }
                        />
                      </div>
                    )
                  )}
                  {active && (
                    <div className="manager-cover-preview">
                      <h3>
                        旅行封面 ·{" "}
                        {form.coverPhotoIds.length
                          ? `${form.coverPhotoIds.length} 张已选`
                          : "自动组合四张"}
                      </h3>
                      <TripCover
                        album={{ ...active, coverPhotoIds: form.coverPhotoIds }}
                        photos={previewPhotos}
                        mediaBase={config.mediaUrl}
                      />
                      <p className="manager-help">
                        在下方照片列表勾选最多四张封面；不勾选时自动选择不同位置的照片。
                      </p>
                    </div>
                  )}
                  <button className="travel-button" type="submit">
                    {selected ? "保存旅行信息" : "创建旅行"}
                  </button>
                </fieldset>
              </form>
            </section>
            <section className="manager-upload">
              <h2>02 / 上传照片</h2>
              <p>
                JPEG、PNG、WebP · 单张最多 64MiB
                <br />
                自动生成高清切片，并读取相机、镜头、拍摄参数和 GPS。
              </p>
              <label
                className={`photo-dropzone${!selected || busy ? " is-disabled" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void upload(e.dataTransfer.files);
                }}
              >
                <span>＋</span>
                <strong>
                  {selected ? "选择照片，或拖到这里" : "先创建或选择一次旅行"}
                </strong>
                <span>手机和电脑均可批量选择</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={!selected || busy}
                  onChange={(e) => void upload(e.target.files)}
                />
              </label>
              {progress && (
                <div className="manager-progress">
                  <span>{progress.name}</span>
                  <progress
                    value={progress.value}
                    max={1}
                    aria-label="当前照片上传进度"
                  />
                  <div>
                    <span>{Math.round(progress.value * 100)}%</span>
                    <button onClick={() => abort.current?.abort()}>
                      暂停上传
                    </button>
                  </div>
                </div>
              )}
              <p className="manager-help">
                网络中断可重新选择同一文件续传；刷新后需重新登录。手机锁屏或关闭标签页可能暂停上传。
              </p>
              <button
                className="travel-button is-secondary"
                disabled={
                  busy ||
                  !state?.photos.some(
                    (photo) =>
                      ["queued", "processing"].includes(photo.state) ||
                      ["queued", "processing"].includes(photo.metadata_state),
                  )
                }
                onClick={() =>
                  void run(async () => {
                    const result = await photoApi<{ message: string }>(
                      config.apiUrl,
                      token,
                      "/admin/process",
                      { albumId: selected },
                    );
                    setMessage(result.message);
                    await refresh();
                  })
                }
              >
                {selected ? "处理当前旅行的待办照片" : "处理全部待办照片"}
              </button>
              <div className="manager-publish">
                <h2>03 / 确认发布</h2>
                <p>
                  处理完成不代表公开。点发布后，当前旅行中已准备好的照片才会出现在网站。
                </p>
                <div className="manager-actions">
                  <button
                    className="travel-button"
                    disabled={
                      busy ||
                      !active ||
                      !state?.photos.some(
                        (photo) =>
                          photo.album_id === selected &&
                          photo.state === "ready",
                      )
                    }
                    onClick={() =>
                      void run(async () => {
                        await photoApi(
                          config.apiUrl,
                          token,
                          `/admin/albums/${selected}/publish`,
                          {},
                        );
                        await refresh();
                        setMessage(
                          "已发布。公开列表缓存约 60 秒，之后刷新旅行页即可看到。",
                        );
                      })
                    }
                  >
                    发布当前旅行
                  </button>
                  {active?.published === 1 && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await photoApi(
                            config.apiUrl,
                            token,
                            `/admin/albums/${selected}/unpublish`,
                            {},
                          );
                          await refresh();
                          setMessage(
                            "已从旅行列表撤下。已公开图片的直链和缓存不会因此失效。",
                          );
                        })
                      }
                    >
                      从列表撤下
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
          <section className="manager-jobs">
            <h2>照片状态</h2>
            {state?.photos.length ? (
              state.photos
                .filter((photo) => !selected || photo.album_id === selected)
                .map((photo) => (
                  <div className="manager-job" key={photo.id}>
                    <div>
                      {photo.thumbnail && (
                        <div className="manager-photo-preview">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${config.mediaUrl}/${photo.thumbnail}`}
                            alt=""
                            width={96}
                            height={72}
                            loading="lazy"
                          />
                          <label>
                            <input
                              type="checkbox"
                              checked={(selected === photo.album_id
                                ? form.coverPhotoIds
                                : state.albums.find(
                                    (album) => album.id === photo.album_id,
                                  )?.coverPhotoIds || []
                              ).includes(photo.id)}
                              disabled={busy || photo.state !== "ready"}
                              onChange={() => toggleCover(photo)}
                            />
                            选作旅行封面
                          </label>
                        </div>
                      )}
                      <strong>{photo.filename}</strong>
                      <span>
                        {(photo.bytes / 1_000_000).toFixed(1)} MB
                        {photo.derived_bytes
                          ? ` · 展示文件 ${(photo.derived_bytes / 1_000_000).toFixed(1)} MB`
                          : ""}
                      </span>
                      {photo.error && <p>{photo.error}</p>}
                      {photo.state === "ready" && (
                        <details className="manager-exif">
                          <summary>
                            拍摄信息
                            {cameraName(photo.camera)
                              ? ` · ${cameraName(photo.camera)}`
                              : ""}
                            {["queued", "processing"].includes(
                              photo.metadata_state,
                            )
                              ? " · 正在读取 EXIF…"
                              : ""}
                          </summary>
                          <PhotoFacts camera={photo.camera} />
                          {photo.metadata_error && (
                            <p role="status">{photo.metadata_error}</p>
                          )}
                          {photo.gps ? (
                            <>
                              <p className="mono">
                                GPS {photo.gps.latitude.toFixed(6)},{" "}
                                {photo.gps.longitude.toFixed(6)}
                              </p>
                              <label>
                                照片位置
                                <select
                                  disabled={busy}
                                  value={photo.location_mode || "exact"}
                                  onChange={(event) =>
                                    void run(async () => {
                                      await photoApi(
                                        config.apiUrl,
                                        token,
                                        `/admin/photos/${photo.id}/location`,
                                        { mode: event.target.value },
                                      );
                                      await refresh();
                                      setMessage("照片位置显示方式已更新。");
                                    })
                                  }
                                >
                                  <option value="exact">
                                    随照片公开精确 GPS
                                  </option>
                                  <option value="hidden">
                                    不公开这张照片的 GPS
                                  </option>
                                </select>
                              </label>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setGpsPreview(
                                    gpsPreview === photo.id ? "" : photo.id,
                                  )
                                }
                              >
                                {gpsPreview === photo.id
                                  ? "收起地图"
                                  : "自动定位拍摄位置 ↗"}
                              </button>
                              {gpsPreview === photo.id && (
                                <LocationMap
                                  latitude={photo.gps.latitude}
                                  longitude={photo.gps.longitude}
                                  place="照片 GPS 拍摄位置"
                                  mapConfig={config}
                                />
                              )}
                            </>
                          ) : (
                            <p className="manager-help">
                              没有可用
                              GPS，不会猜测位置。部分相机需要开启手机位置同步才能写入
                              GPS。
                            </p>
                          )}
                          <div className="manager-actions">
                            {(photo.gps || photo.camera?.capturedAt) && (
                              <button
                                disabled={busy}
                                onClick={() => {
                                  selectAlbum(photo.album_id);
                                  setForm((old) => ({
                                    ...old,
                                    ...(photo.gps
                                      ? {
                                          latitude: String(photo.gps.latitude),
                                          googlePlaceId: null,
                                          longitude: String(
                                            photo.gps.longitude,
                                          ),
                                        }
                                      : {}),
                                    ...(photo.camera?.capturedAt
                                      ? {
                                          date: photo.camera.capturedAt.slice(
                                            0,
                                            10,
                                          ),
                                        }
                                      : {}),
                                  }));
                                  if (photo.gps) setShowMap(true);
                                  setMessage(
                                    "已填入旅行日期/参考点，确认后点击保存旅行信息。",
                                  );
                                }}
                              >
                                用这张照片填入旅行信息
                              </button>
                            )}
                            <button
                              disabled={
                                busy ||
                                ["queued", "processing"].includes(
                                  photo.metadata_state,
                                )
                              }
                              onClick={() =>
                                void run(async () => {
                                  await photoApi(
                                    config.apiUrl,
                                    token,
                                    `/admin/photos/${photo.id}/read-metadata`,
                                    {},
                                  );
                                  await refresh();
                                  setMessage(
                                    "已启动 EXIF 补读，不会重新生成切片。",
                                  );
                                })
                              }
                            >
                              重新读取 EXIF
                            </button>
                          </div>
                        </details>
                      )}
                    </div>
                    <span>
                      {photo.published ? "已发布" : statuses[photo.state]}
                    </span>
                    {photo.state === "failed" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await photoApi(
                              config.apiUrl,
                              token,
                              `/admin/photos/${photo.id}/retry`,
                              {},
                            );
                            await refresh();
                            setMessage("已放回待办，请点击处理待办照片。");
                          })
                        }
                      >
                        重试
                      </button>
                    )}
                    {photo.state === "uploading" && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "取消这个未完成的上传并释放额度？已成功发布的照片不受影响。",
                            )
                          )
                            void run(async () => {
                              await photoApi(
                                config.apiUrl,
                                token,
                                `/admin/uploads/${photo.id}/abort`,
                                {},
                              );
                              await refresh();
                            });
                        }}
                      >
                        取消未完成上传
                      </button>
                    )}
                  </div>
                ))
            ) : (
              <p>还没有上传照片。</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
