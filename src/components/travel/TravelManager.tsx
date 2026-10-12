"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  albumInput,
  formatBytes,
  type TravelConfig,
  type TravelPhoto,
} from "@/lib/travel";
import { loadTravelConfig, photoApi, uploadPhoto } from "@/lib/travel-client";
import { cameraName } from "@/lib/photo-metadata";
import {
  photosForTrip,
  type LibraryState as State,
  type ManagedPhoto as Photo,
} from "@/lib/photo-library";
import PhotoLibrary from "./PhotoLibrary";
import ConfirmAction, { useConfirmation } from "./ConfirmAction";
import PhotoFacts from "./PhotoFacts";
import EquipmentFields from "./EquipmentFields";
import PhotoEquipmentEditor from "./PhotoEquipmentEditor";
import TripCover from "./TripCover";
import {
  albumForm,
  formFingerprint,
  moveCover,
  publicationCheck,
} from "@/lib/travel-editor";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });
const blank = albumForm();
const statuses: Record<string, string> = {
  uploading: "上传未完成",
  queued: "等待处理",
  processing: "正在切片",
  ready: "可以发布",
  failed: "处理失败",
};

export default function TravelManager() {
  const confirmation = useConfirmation();
  const confirm = confirmation.confirm;
  const [config, setConfig] = useState<TravelConfig | null>(null);
  const [password, setPassword] = useState(""),
    [token, setToken] = useState("");
  const [state, setState] = useState<State | null>(null),
    [selected, setSelected] = useState("");
  const [form, setForm] = useState(blank),
    [showMap, setShowMap] = useState(false);
  const [savedForm, setSavedForm] = useState(blank);
  const [step, setStep] = useState<"details" | "photos" | "publish">("details");
  const [workspace, setWorkspace] = useState<"trips" | "library" | "trash">(
    "trips",
  );
  const [photoFilter, setPhotoFilter] = useState("all");
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [dirtyEquipment, setDirtyEquipment] = useState<Record<string, boolean>>(
    {},
  );
  const equipmentDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyEquipment((old) =>
      old[id] === dirty ? old : { ...old, [id]: dirty },
    );
  }, []);
  const dirty = formFingerprint(form) !== formFingerprint(savedForm);
  const unsaved = dirty || Object.values(dirtyEquipment).some(Boolean);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [progress, setProgress] = useState<{
    name: string;
    value: number;
  } | null>(null);
  const [gpsPreview, setGpsPreview] = useState("");
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!unsaved && !progress) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const linkGuard = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        link.target === "_blank" ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (new URL(link.href).pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      void confirm({
        title: "离开编辑页？",
        description: "当前有未保存的修改或上传任务，离开后可能需要重新处理。",
        action: "放弃并离开",
      }).then((leave) => {
        if (leave) window.location.assign(link.href);
      });
    };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", linkGuard, true);
    return () => {
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("click", linkGuard, true);
    };
  }, [unsaved, progress, confirm]);
  useEffect(() => {
    let alive = true;
    void loadTravelConfig()
      .then((value) => {
        if (alive) {
          setConfig(value);
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
      !photo.deleted_at &&
      (["queued", "processing"].includes(photo.state) ||
        ["queued", "processing"].includes(photo.metadata_state)),
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
    if (id === selected && id) return;
    if (unsaved) {
      setPendingSwitch(id);
      return;
    }
    applyAlbumSelection(id);
  }
  function applyAlbumSelection(id: string) {
    setPendingSwitch(null);
    setSelected(id);
    setShowMap(false);
    const album = state?.albums.find((a) => a.id === id);
    const next = albumForm(album);
    setForm(next);
    setSavedForm(next);
    setDirtyEquipment({});
    setPhotoFilter("all");
    setStep("details");
    setError("");
    setMessage("");
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("trip", id);
    else url.searchParams.delete("trip");
    window.history.replaceState({}, "", url);
  }
  async function saveAlbum() {
    const data = albumInput(form);
    let id = selected;
    if (id)
      await photoApi(config!.apiUrl, token, `/admin/albums/${id}/edit`, data);
    else {
      const created = await photoApi<{ id: string }>(
        config!.apiUrl,
        token,
        "/admin/albums",
        data,
      );
      id = created.id;
      setSelected(id);
      setStep("photos");
      const url = new URL(window.location.href);
      url.searchParams.set("trip", id);
      window.history.replaceState({}, "", url);
    }
    const next = albumForm({ id, ...data });
    setForm(next);
    setSavedForm(next);
    await refresh();
    setMessage("旅行信息与封面已保存。");
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
      const requestedAlbum =
        next.albums.find(
          (album) => album.id === requestedTrip && !album.deleted_at,
        ) || next.albums.find((album) => !album.deleted_at);
      const requestedView = new URLSearchParams(window.location.search).get(
        "view",
      );
      setWorkspace(
        requestedView === "library" || requestedView === "trash"
          ? requestedView
          : "trips",
      );
      if (requestedAlbum) {
        setSelected(requestedAlbum.id);
        setForm(albumForm(requestedAlbum));
        setSavedForm(albumForm(requestedAlbum));
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
        try {
          await photoApi(config!.apiUrl, token, "/admin/process", {
            albumId: selected,
          });
          setMessage(
            `${picked.length} 张已上传，高清处理已启动。你可以继续编辑，处理完成后再发布。`,
          );
        } catch {
          setMessage(
            `${picked.length} 张原片已安全上传，但自动处理未启动。请点击“处理当前旅行的待办照片”重试，不必重复上传。`,
          );
        }
      } finally {
        setProgress(null);
        abort.current = null;
        if (fileInput.current) fileInput.current.value = "";
        await refresh();
      }
    });
  }
  const active = state?.albums.find(
    (album) => album.id === selected && !album.deleted_at,
  );
  const tripPhotos = photosForTrip(state, active);
  const check = publicationCheck(tripPhotos, unsaved);
  const visiblePhotos = tripPhotos.filter(
    (photo) =>
      photoFilter === "all" ||
      (photoFilter === "covers"
        ? form.coverPhotoIds.includes(photo.id)
        : photo.state !== "ready"),
  );
  const previewPhotos: TravelPhoto[] = tripPhotos
    .filter((photo) => photo.state === "ready" && photo.thumbnail)
    .map((photo) => ({
      id: photo.id,
      albumId: selected,
      caption: "",
      width: photo.width || 1,
      height: photo.height || 1,
      thumbnail: photo.thumbnail!,
      preview: "",
      dzi: "",
    }));
  function toggleCover(photo: Photo) {
    const saved = form.coverPhotoIds;
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
  function switchWorkspace(next: typeof workspace) {
    if (busy) return;
    if (unsaved) {
      setError("请先保存当前旅行和设备修改，再切换管理区域。");
      return;
    }
    setWorkspace(next);
    setError("");
    setMessage("");
    const url = new URL(window.location.href);
    if (next === "trips") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState({}, "", url);
  }
  async function updateTripPhotos(action: "remove" | "reorder", ids: string[]) {
    await photoApi(
      config!.apiUrl,
      token,
      `/admin/albums/${selected}/photos/${action}`,
      { photoIds: ids },
    );
    const next = await refresh();
    const album = next?.albums.find((item) => item.id === selected);
    if (album) {
      const saved = albumForm(album);
      setForm(saved);
      setSavedForm(saved);
    }
    setMessage(
      action === "remove"
        ? "已移出本次旅行，照片仍保存在照片库。已发布旅行的清单约 60 秒更新。"
        : "照片顺序已保存。",
    );
  }
  return (
    <div className="travel-manager">
      <div className="manager-heading">
        <div>
          <p className="eyebrow">PRIVATE / 影集管理</p>
          <h1>
            记录下一程<span className="accent">.</span>
          </h1>
          <p>整理照片库，编排旅行，再发布。无需重新构建网站。</p>
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
                onClick={async () => {
                  if (
                    unsaved &&
                    !(await confirmation.confirm({
                      title: "退出管理？",
                      description: "当前未保存的修改将被放弃。",
                      action: "放弃并退出",
                    }))
                  )
                    return;
                  setToken("");
                  setState(null);
                  setSelected("");
                  setForm(blank);
                  setSavedForm(blank);
                  setDirtyEquipment({});
                }}
              >
                退出
              </button>
            </div>
          </div>
          <nav className="manager-workspaces" aria-label="影集管理区域">
            {(
              [
                ["trips", "旅行编排"],
                ["library", "照片库"],
                ["trash", "回收站"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                disabled={busy || (id !== "trips" && !state?.libraryVersion)}
                aria-pressed={workspace === id}
                onClick={() => switchWorkspace(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          {!state?.libraryVersion && (
            <p className="manager-help">
              照片库服务升级中，稍后刷新可使用独立照片库。
            </p>
          )}
          {workspace !== "trips" && state && (
            <PhotoLibrary
              key={workspace}
              state={state}
              config={config}
              token={token}
              trash={workspace === "trash"}
              initialTrip={selected}
              onRefresh={refresh}
              onBusyChange={setBusy}
              onAttached={(id) => {
                applyAlbumSelection(id);
                setWorkspace("trips");
                setStep("photos");
                setMessage(
                  "照片已加入旅行，尚未自动发布。可以调整顺序、选择封面，再发布。",
                );
                const url = new URL(window.location.href);
                url.searchParams.delete("view");
                window.history.replaceState({}, "", url);
              }}
            />
          )}
          <div hidden={workspace !== "trips"}>
            <div className="manager-trip-selector">
              <div className="manager-section-title">
                <h2>{active ? active.title : "新建一次旅行"}</h2>
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
                  {state?.albums
                    .filter((album) => !album.deleted_at)
                    .map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.title}
                        {album.published ? " · 已发布" : " · 草稿"}
                      </option>
                    ))}
                </select>
              </label>
              {active && state?.libraryVersion && (
                <button
                  className="library-danger"
                  disabled={busy || unsaved}
                  onClick={async () => {
                    if (
                      !(await confirmation.confirm({
                        title: `删除旅行「${active.title}」？`,
                        description:
                          "照片库中的照片不会删除，可以在回收站恢复旅行。已发布旅行会从网站撤下。",
                        action: "确认删除旅行",
                      }))
                    )
                      return;
                    void run(async () => {
                      await photoApi(
                        config.apiUrl,
                        token,
                        `/admin/albums/${selected}/trash`,
                        {},
                      );
                      await refresh();
                      applyAlbumSelection("");
                      setMessage(
                        "旅行已移入回收站，照片库中的原片和切片保留。",
                      );
                    });
                  }}
                >
                  删除这次旅行
                </button>
              )}
            </div>
            <nav className="manager-steps" aria-label="旅行编辑步骤">
              {(
                [
                  ["details", "01", "旅行信息"],
                  ["photos", "02", "照片与封面"],
                  ["publish", "03", "发布检查"],
                ] as const
              ).map(([id, number, label]) => (
                <button
                  key={id}
                  disabled={busy || (id !== "details" && !selected)}
                  aria-current={step === id ? "step" : undefined}
                  onClick={() => setStep(id)}
                >
                  <span className="mono">{number}</span>
                  {label}
                  {id === "photos" && <small>{tripPhotos.length}</small>}
                </button>
              ))}
            </nav>
            {pendingSwitch !== null && (
              <div className="manager-switch-guard" role="alert">
                <strong>当前旅行还有未保存的修改</strong>
                <p>切换前可以先保存，或留在这里继续编辑。</p>
                <div className="manager-actions">
                  <button
                    className="travel-button"
                    onClick={() => setPendingSwitch(null)}
                  >
                    继续编辑
                  </button>
                  <button
                    disabled={
                      busy || Object.values(dirtyEquipment).some(Boolean)
                    }
                    onClick={() =>
                      void run(async () => {
                        const id = pendingSwitch;
                        await saveAlbum();
                        applyAlbumSelection(id);
                      })
                    }
                  >
                    保存旅行后切换
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => applyAlbumSelection(pendingSwitch)}
                  >
                    放弃修改并切换
                  </button>
                </div>
                {Object.values(dirtyEquipment).some(Boolean) && (
                  <p>单张设备修改请先回到对应照片保存。</p>
                )}
              </div>
            )}
            <div className="manager-layout">
              <section className="manager-album" hidden={step !== "details"}>
                <h2>给这段旅程一个名字</h2>
                <p className="manager-help">
                  先写下地点与简短记录。日期、坐标和设备可以稍后补充。
                </p>
                <form
                  id="trip-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(saveAlbum);
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
                          min={-90}
                          max={90}
                          step="any"
                          value={form.latitude}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              latitude: e.target.value,
                              googlePlaceId: null,
                            })
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
                            setForm({
                              ...form,
                              longitude: e.target.value,
                              googlePlaceId: null,
                            })
                          }
                          placeholder="可留空"
                        />
                      </label>
                    </div>
                    <p className="manager-help">
                      每次旅行一个标记：优先使用你选择的旅行地点，否则取首张公开
                      GPS
                      照片的位置。没有坐标时不会生成图钉；地点名称本身不会自动转换成坐标。
                    </p>
                    <div className="manager-actions">
                      <button
                        type="button"
                        onClick={() => setShowMap(!showMap)}
                      >
                        {showMap ? "收起选点地图" : "在免费地图上放置图钉"}
                      </button>
                      {form.place && (
                        <a
                          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(form.place)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          在 OpenStreetMap 查找地点 ↗
                        </a>
                      )}
                    </div>
                    {form.googlePlaceId && (
                      <p className="manager-help">
                        这条记录关联了旧地图服务，需重新点选或填写坐标才能显示为免费地图图钉。
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, googlePlaceId: null })
                          }
                        >
                          清除旧地点关联
                        </button>
                      </p>
                    )}
                    {showMap && (
                      <LocationMap
                        latitude={
                          form.latitude === "" ? null : Number(form.latitude)
                        }
                        longitude={
                          form.longitude === "" ? null : Number(form.longitude)
                        }
                        place={form.place}
                        onPick={(latitude, longitude) =>
                          setForm((old) => ({
                            ...old,
                            latitude: latitude.toFixed(5),
                            longitude: longitude.toFixed(5),
                            googlePlaceId: null,
                          }))
                        }
                      />
                    )}
                    <details className="trip-equipment-defaults">
                      <summary>这次旅行的默认设备</summary>
                      <p className="manager-help">
                        照片没有机身或镜头名称时，使用这里填写的设备并标为“旅行默认”；不会覆盖
                        EXIF 中已有的名称。混用设备的照片可以在下方单独补录。
                      </p>
                      <EquipmentFields
                        value={form.equipmentDefaults}
                        onChange={(equipmentDefaults) =>
                          setForm({ ...form, equipmentDefaults })
                        }
                        disabled={busy}
                      />
                    </details>
                  </fieldset>
                </form>
              </section>
              <section className="manager-upload" hidden={step !== "photos"}>
                <h2>照片与封面</h2>
                {state?.libraryVersion && (
                  <div className="manager-library-entry">
                    <div>
                      <h3>从已处理照片库中编排</h3>
                      <p>
                        筛选文件夹并批量选择，不重复上传。移出旅行也不会删除照片。
                      </p>
                    </div>
                    <button
                      className="travel-button"
                      disabled={busy || unsaved || !selected}
                      onClick={() => switchWorkspace("library")}
                    >
                      从照片库添加 ＋
                    </button>
                  </div>
                )}
                {active && (
                  <div className="manager-cover-workspace">
                    <div className="manager-cover-preview">
                      <TripCover
                        album={{ ...active, coverPhotoIds: form.coverPhotoIds }}
                        photos={previewPhotos}
                        mediaBase={config.mediaUrl}
                      />
                    </div>
                    <div>
                      <h3>
                        {form.coverPhotoIds.length
                          ? `${form.coverPhotoIds.length} 张封面已选`
                          : "自动组合封面"}
                      </h3>
                      <p className="manager-help">
                        在下方勾选最多四张。第一张也是旅行手记的大幅封面，使用箭头调整顺序。
                      </p>
                      <ol className="cover-order">
                        {form.coverPhotoIds.map((id, index) => (
                          <li key={id}>
                            <span>
                              {index + 1}.{" "}
                              {tripPhotos.find((photo) => photo.id === id)
                                ?.filename || "照片"}
                            </span>
                            <button
                              disabled={busy || index === 0}
                              aria-label={`封面 ${index + 1} 前移`}
                              onClick={() =>
                                setForm((old) => ({
                                  ...old,
                                  coverPhotoIds: moveCover(
                                    old.coverPhotoIds,
                                    id,
                                    -1,
                                  ),
                                }))
                              }
                            >
                              ↑
                            </button>
                            <button
                              disabled={
                                busy || index === form.coverPhotoIds.length - 1
                              }
                              aria-label={`封面 ${index + 1} 后移`}
                              onClick={() =>
                                setForm((old) => ({
                                  ...old,
                                  coverPhotoIds: moveCover(
                                    old.coverPhotoIds,
                                    id,
                                    1,
                                  ),
                                }))
                              }
                            >
                              ↓
                            </button>
                          </li>
                        ))}
                      </ol>
                      {form.coverPhotoIds.length > 0 && (
                        <button
                          className="travel-text-button"
                          disabled={busy}
                          onClick={() =>
                            setForm((old) => ({ ...old, coverPhotoIds: [] }))
                          }
                        >
                          恢复自动封面
                        </button>
                      )}
                    </div>
                  </div>
                )}
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
                    {selected
                      ? "上传新照片并加入本次旅行"
                      : "先创建或选择一次旅行"}
                  </strong>
                  <span>同时收入照片库 · 手机和电脑均可批量选择</span>
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
                    !tripPhotos.some(
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
              </section>
              <section className="manager-publish" hidden={step !== "publish"}>
                <p className="eyebrow">READY WHEN YOU ARE</p>
                <h2>最后看一眼，再分享。</h2>
                <ul className="publish-checklist">
                  <li data-ok={!unsaved}>
                    <span>{unsaved ? "○" : "✓"}</span>
                    {unsaved
                      ? "还有未保存的旅行或单张设备修改"
                      : "所有编辑已保存"}
                  </li>
                  <li data-ok={check.ready > 0 && !check.unfinished}>
                    <span>
                      {check.ready > 0 && !check.unfinished ? "✓" : "○"}
                    </span>
                    {check.ready} 张照片准备完成
                    {check.unfinished
                      ? `，${check.unfinished} 张尚未完成，请先处理或取消未完成上传`
                      : ""}
                  </li>
                  <li>
                    <span>↗</span>
                    {active?.place ||
                      (active?.googlePlaceId
                        ? "旧地点关联尚未转换，请重新点选坐标"
                        : "未填写旅行地点；有公开 GPS 的照片仍可生成足迹")}
                  </li>
                </ul>
                <p>
                  发布将公开当前旅行全部已完成照片，以及你允许公开的设备信息和精确
                  GPS。
                </p>
                <p>
                  处理完成不代表公开。点发布后，当前旅行中已准备好的照片才会出现在网站。
                </p>
                <div className="manager-actions">
                  <button
                    className="travel-button"
                    disabled={busy || !active || !check.canPublish}
                    onClick={() =>
                      void run(async () => {
                        if (
                          !(await confirmation.confirm({
                            title: `发布「${active?.title}」？`,
                            description: `将公开 ${check.ready} 张照片及允许公开的设备信息和 GPS。公开清单约 60 秒刷新。`,
                            action: "确认发布",
                          }))
                        )
                          return;
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
                    {active?.published ? "更新已发布旅行" : "确认发布旅行"}
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
              </section>
            </div>
            <section className="manager-jobs" hidden={step !== "photos"}>
              <div className="manager-section-title">
                <h2>
                  这次旅行的照片{" "}
                  <span className="mono">/ {tripPhotos.length}</span>
                </h2>
                <div className="photo-filters" aria-label="筛选照片">
                  {[
                    ["all", "全部"],
                    ["covers", "已选封面"],
                    ["pending", "待处理"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={photoFilter === id}
                      onClick={() => setPhotoFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {!visiblePhotos.length && (
                <p className="manager-help">
                  {tripPhotos.length
                    ? "当前筛选没有照片。"
                    : "还没有照片，上传后会在这里显示。"}
                </p>
              )}
              {tripPhotos.length ? (
                tripPhotos.map((photo, photoIndex) => (
                  <div
                    className="manager-job"
                    key={photo.id}
                    hidden={!visiblePhotos.includes(photo)}
                  >
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
                              checked={form.coverPhotoIds.includes(photo.id)}
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
                          <PhotoFacts
                            camera={photo.camera}
                            sources={photo.equipmentSources}
                          />
                          <PhotoEquipmentEditor
                            key={`${photo.id}:${JSON.stringify(photo.equipment || {})}`}
                            equipment={photo.equipment || {}}
                            photoId={photo.id}
                            onDirtyChange={equipmentDirty}
                            disabled={busy}
                            onSave={async (equipment) => {
                              await run(async () => {
                                await photoApi(
                                  config.apiUrl,
                                  token,
                                  `/admin/photos/${photo.id}/equipment`,
                                  equipment,
                                );
                                await refresh();
                                setMessage(
                                  "设备信息已保存，原始 EXIF 和切片未修改。",
                                );
                              });
                            }}
                          />
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
                                  setStep("details");
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
                    {state?.libraryVersion && (
                      <div className="manager-photo-actions">
                        <span className="mono">
                          {String(photoIndex + 1).padStart(2, "0")}
                        </span>
                        <button
                          disabled={
                            busy ||
                            unsaved ||
                            photoIndex === 0 ||
                            tripPhotos.length > 100
                          }
                          aria-label={`${photo.filename} 前移`}
                          onClick={() =>
                            void run(() =>
                              updateTripPhotos(
                                "reorder",
                                moveCover(
                                  tripPhotos.map((item) => item.id),
                                  photo.id,
                                  -1,
                                ),
                              ),
                            )
                          }
                        >
                          ↑
                        </button>
                        <button
                          disabled={
                            busy ||
                            unsaved ||
                            photoIndex === tripPhotos.length - 1 ||
                            tripPhotos.length > 100
                          }
                          aria-label={`${photo.filename} 后移`}
                          onClick={() =>
                            void run(() =>
                              updateTripPhotos(
                                "reorder",
                                moveCover(
                                  tripPhotos.map((item) => item.id),
                                  photo.id,
                                  1,
                                ),
                              ),
                            )
                          }
                        >
                          ↓
                        </button>
                        <button
                          className="library-danger"
                          disabled={busy || unsaved}
                          onClick={async () => {
                            if (
                              !(await confirmation.confirm({
                                title: `移出「${photo.filename}」？`,
                                description:
                                  "只移出本次旅行，照片库和其他旅行不受影响。",
                                action: "确认移出旅行",
                              }))
                            )
                              return;
                            void run(() =>
                              updateTripPhotos("remove", [photo.id]),
                            );
                          }}
                        >
                          移出旅行
                        </button>
                      </div>
                    )}
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
                        onClick={async () => {
                          if (
                            await confirmation.confirm({
                              title: "取消未完成的上传？",
                              description:
                                "清理上传分片并释放额度，已成功发布的照片不受影响。",
                              action: "确认取消上传",
                            })
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
            <div className="manager-savebar">
              <div>
                <strong>
                  {busy
                    ? "正在保存或处理…"
                    : dirty
                      ? "有未保存的旅行修改"
                      : "旅行信息已保存"}
                </strong>
                <span>
                  {Object.values(dirtyEquipment).some(Boolean)
                    ? "单张设备修改请在对应照片下保存"
                    : "封面、地点与默认设备随旅行信息一起保存"}
                </span>
              </div>
              <div className="manager-savebar-actions">
                {active?.published === 1 && (
                  <Link
                    href={`/travel/?trip=${selected}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看线上 ↗
                  </Link>
                )}
                <button
                  className="travel-button"
                  disabled={busy || (!dirty && Boolean(selected))}
                  onClick={() => {
                    if (!form.title.trim()) {
                      setStep("details");
                      setError("请先填写旅行标题。");
                      return;
                    }
                    void run(saveAlbum);
                  }}
                >
                  {selected ? "保存修改" : "创建旅行并添加照片"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <ConfirmAction
        request={confirmation.request}
        onResolve={confirmation.resolve}
      />
    </div>
  );
}
