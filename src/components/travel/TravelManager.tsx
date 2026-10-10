"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  albumInput,
  formatBytes,
  type TravelAlbum,
  type TravelConfig,
} from "@/lib/travel";
import { loadTravelConfig, photoApi, uploadPhoto } from "@/lib/travel-client";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });
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
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    void loadTravelConfig()
      .then((value) => {
        if (alive) setConfig(value);
      })
      .catch(() => {
        if (alive) setError("无法读取配置，请重新打开页面");
      });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, []);
  const pending = state?.photos.some((photo) =>
    ["queued", "processing"].includes(photo.state),
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
                      公开地点
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
                        min={-85}
                        max={85}
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
                    只公开你填写的位置，不自动发布照片
                    GPS。可以把标记放在城市中心。
                  </p>
                  <div className="manager-actions">
                    <button type="button" onClick={() => setShowMap(!showMap)}>
                      {showMap ? "收起选点地图" : "在地图上选点"}
                    </button>
                    {form.place && (
                      <a
                        href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(form.place)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        搜索地点 ↗
                      </a>
                    )}
                  </div>
                  {showMap && (
                    <LocationMap
                      latitude={Number(form.latitude) || 0}
                      longitude={Number(form.longitude) || 0}
                      place={form.place}
                      onPick={(latitude, longitude) =>
                        setForm((old) => ({
                          ...old,
                          latitude: latitude.toFixed(5),
                          longitude: longitude.toFixed(5),
                        }))
                      }
                    />
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
                缩略图和高清切片由后台自动生成。
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
                  !state?.photos.some((photo) =>
                    ["queued", "processing"].includes(photo.state),
                  )
                }
                onClick={() =>
                  void run(async () => {
                    const result = await photoApi<{ message: string }>(
                      config.apiUrl,
                      token,
                      "/admin/process",
                      {},
                    );
                    setMessage(result.message);
                    await refresh();
                  })
                }
              >
                处理待办照片
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
                      <strong>{photo.filename}</strong>
                      <span>
                        {(photo.bytes / 1_000_000).toFixed(1)} MB
                        {photo.derived_bytes
                          ? ` · 展示文件 ${(photo.derived_bytes / 1_000_000).toFixed(1)} MB`
                          : ""}
                      </span>
                      {photo.error && <p>{photo.error}</p>}
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
