"use client";
/* eslint-disable @next/next/no-img-element -- R2 thumbnails are already processed and served directly. */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  LIBRARY_ALBUM_ID,
  photoStatuses,
  type LibraryState,
  type ManagedPhoto,
} from "@/lib/photo-library";
import { photoApi, uploadPhoto } from "@/lib/travel-client";
import { formatBytes, type TravelConfig, type TravelPhoto } from "@/lib/travel";
import { cameraName, resolveEquipment } from "@/lib/photo-metadata";
import PhotoFacts from "./PhotoFacts";
import ConfirmAction, { useConfirmation } from "./ConfirmAction";

const PhotoViewer = dynamic(() => import("./PhotoViewer"), { ssr: false });

export default function PhotoLibrary({
  state,
  config,
  token,
  trash = false,
  initialTrip = "",
  onRefresh,
  onBusyChange,
  onAttached,
}: {
  state: LibraryState;
  config: TravelConfig;
  token: string;
  trash?: boolean;
  initialTrip?: string;
  onRefresh: () => Promise<LibraryState | undefined>;
  onBusyChange: (busy: boolean) => void;
  onAttached: (id: string) => void;
}) {
  const confirmation = useConfirmation();
  const [folder, setFolder] = useState("all"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]),
    [limit, setLimit] = useState(40);
  const [targetTrip, setTargetTrip] = useState(initialTrip),
    [moveTo, setMoveTo] = useState("");
  const [newFolder, setNewFolder] = useState(""),
    [rename, setRename] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [progress, setProgress] = useState<{
      name: string;
      value: number;
    } | null>(null),
    [previewId, setPreviewId] = useState("");
  const abort = useRef<AbortController | null>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const activePhotos = state.photos.filter((photo) => !photo.deleted_at);
  const trips = state.albums.filter((album) => !album.deleted_at);
  const activeFolder = state.folders?.find((item) => item.id === folder);
  const uses = (id: string) =>
    (state.memberships || []).filter(
      (link) =>
        link.photo_id === id && trips.some((trip) => trip.id === link.album_id),
    );
  const matching = state.photos.filter(
    (photo) =>
      Boolean(photo.deleted_at) === trash &&
      (folder === "all" ||
        (folder === "unfiled"
          ? !photo.folder_id
          : photo.folder_id === folder)) &&
      (!query ||
        `${photo.filename} ${cameraName(photo.camera)}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())) &&
      (filter === "all" ||
        (filter === "ready"
          ? photo.state === "ready"
          : filter === "unused"
            ? uses(photo.id).length === 0
            : photo.state !== "ready")),
  );
  const visible = matching.slice(0, limit);
  const picked = state.photos.filter((photo) => selected.includes(photo.id));
  const allReady =
    picked.length > 0 &&
    picked.every((photo) => photo.state === "ready" && !photo.deleted_at);
  const previewPhotos: TravelPhoto[] = matching
    .filter(
      (photo) => photo.state === "ready" && photo.thumbnail && !photo.purging,
    )
    .map((photo) => ({
      id: photo.id,
      albumId: photo.album_id,
      caption: photo.filename,
      width: photo.width || 1,
      height: photo.height || 1,
      thumbnail: photo.thumbnail!,
      preview: photo.thumbnail!.replace("thumbnail.jpg", "preview.jpg"),
      dzi: photo.thumbnail!.replace("thumbnail.jpg", "image.dzi"),
      ...resolveEquipment(
        photo.rawCamera === undefined ? photo.camera : photo.rawCamera,
        photo.equipment,
      ),
      location: photo.gps,
    }));
  const preview = previewPhotos.find((photo) => photo.id === previewId),
    previewIndex = previewPhotos.findIndex((photo) => photo.id === previewId);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作未完成，请重试");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  function changeFolder(id: string) {
    setFolder(id);
    setRename(state.folders?.find((item) => item.id === id)?.name || "");
    setSelected([]);
    setLimit(40);
  }
  function toggle(id: string) {
    setSelected((old) =>
      old.includes(id)
        ? old.filter((value) => value !== id)
        : old.length < 40
          ? [...old, id]
          : old,
    );
  }
  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    const pickedFiles = [...files];
    await run(async () => {
      const controller = new AbortController();
      abort.current = controller;
      let uploaded = 0;
      try {
        for (const file of pickedFiles) {
          setProgress({ name: file.name, value: 0 });
          await uploadPhoto(
            config.apiUrl,
            token,
            LIBRARY_ALBUM_ID,
            file,
            (value) => setProgress({ name: file.name, value }),
            controller.signal,
            activeFolder?.id || null,
          );
          uploaded++;
        }
        await photoApi(config.apiUrl, token, "/admin/process", {});
        setMessage(
          `${uploaded} 张照片已收入照片库，高清处理已启动。处理完成后选择照片加入旅行。`,
        );
      } catch (error) {
        throw new Error(
          `${uploaded} 张已完整上传并保存在照片库。${error instanceof Error ? error.message : "上传中断"}；可重新选择未完成的文件续传，或点击“处理待办”。`,
        );
      } finally {
        setProgress(null);
        abort.current = null;
        if (fileInput.current) fileInput.current.value = "";
        await onRefresh();
      }
    });
  }
  async function bulk(action: "move" | "trash" | "restore") {
    if (
      action === "trash" &&
      !(await confirmation.confirm({
        title: `移除 ${selected.length} 张照片？`,
        description:
          "它们会从所有公开旅行中撤下。R2 原片与切片保留，可在回收站恢复。",
        action: "确认移入回收站",
      }))
    )
      return;
    await run(async () => {
      await photoApi(config.apiUrl, token, `/admin/library/photos/${action}`, {
        photoIds: selected,
        folderId: moveTo || null,
      });
      await onRefresh();
      setSelected([]);
      setMessage(
        action === "move"
          ? "分类已更新，无需搬运或重新切片。"
          : action === "restore"
            ? "已恢复照片，原旅行关联保留为草稿；需要重新发布才会公开。"
            : "已移入回收站；原片与切片仍占用存储，永久删除后才释放。公开清单约 60 秒更新，已有直链缓存可能保留。",
      );
    });
  }
  async function purge(photo: ManagedPhoto) {
    if (
      !(await confirmation.confirm({
        title: `永久删除「${photo.filename}」？`,
        description:
          "将删除 R2 原片、所有版本的预览和高清切片，无法恢复。第三方缓存可能暂存。",
        action: "永久删除",
      }))
    )
      return;
    void run(async () => {
      let done = false;
      try {
        for (let batch = 0; batch < 50 && !done; batch++) {
          const result = await photoApi<{ done: boolean }>(
            config.apiUrl,
            token,
            `/admin/library/photos/${photo.id}/purge`,
            { confirm: photo.id },
          );
          done = result.done;
        }
      } finally {
        // A failed request may already have removed one batch in R2. Refresh
        // the persisted purging flag so the next action resumes, not restores.
        await onRefresh();
      }
      setSelected((old) => old.filter((id) => id !== photo.id));
      setMessage(
        done
          ? "R2 原片和切片已删除，存储额度已释放。"
          : "部分文件已清理，请点击继续删除完成剩余清理。",
      );
    });
  }
  return (
    <section className="photo-library" aria-label={trash ? "回收站" : "照片库"}>
      <div className="library-heading">
        <div>
          <p className="eyebrow">
            {trash ? "RECENTLY REMOVED" : "YOUR IMAGE ARCHIVE"}
          </p>
          <h2>
            {trash ? "回收站" : "所有影像，一个地方"}
            <span className="accent">.</span>
          </h2>
          <p>
            {trash
              ? "恢复不会自动重新发布。永久删除才会释放 R2 空间。"
              : "先上传并处理，再编排旅行。一张照片可用于多次旅行，只存储一份。"}
          </p>
        </div>
        <span className="mono">
          {trash
            ? state.photos.filter((photo) => photo.deleted_at).length
            : activePhotos.length}{" "}
          PHOTOS
        </span>
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
      {trash && (
        <div className="library-deleted-trips">
          <h3>已删除的旅行</h3>
          {state.albums.filter((album) => album.deleted_at).length === 0 ? (
            <p>暂无。删除旅行不会删除照片库中的照片。</p>
          ) : (
            state.albums
              .filter((album) => album.deleted_at)
              .map((album) => (
                <div key={album.id}>
                  <span>{album.title}</span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await photoApi(
                          config.apiUrl,
                          token,
                          `/admin/albums/${album.id}/restore`,
                          {},
                        );
                        await onRefresh();
                        setMessage("旅行已恢复为草稿，照片关联保留。");
                      })
                    }
                  >
                    恢复旅行
                  </button>
                </div>
              ))
          )}
        </div>
      )}
      <div className="library-layout">
        {!trash && (
          <aside className="library-folders" aria-label="照片文件夹">
            <button
              className={folder === "all" ? "is-active" : ""}
              disabled={busy}
              onClick={() => changeFolder("all")}
            >
              全部照片 <span>{activePhotos.length}</span>
            </button>
            <button
              className={folder === "unfiled" ? "is-active" : ""}
              disabled={busy}
              onClick={() => changeFolder("unfiled")}
            >
              未分类{" "}
              <span>
                {activePhotos.filter((photo) => !photo.folder_id).length}
              </span>
            </button>
            {state.folders?.map((item) => (
              <button
                key={item.id}
                className={folder === item.id ? "is-active" : ""}
                disabled={busy}
                onClick={() => changeFolder(item.id)}
              >
                {item.name}
                <span>
                  {
                    activePhotos.filter((photo) => photo.folder_id === item.id)
                      .length
                  }
                </span>
              </button>
            ))}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const result = await photoApi<{ id: string }>(
                    config.apiUrl,
                    token,
                    "/admin/library/folders",
                    { name: newFolder },
                  );
                  await onRefresh();
                  setFolder(result.id);
                  setRename(newFolder);
                  setNewFolder("");
                  setSelected([]);
                  setMessage("文件夹已创建，可以向这里上传照片。");
                });
              }}
            >
              <label>
                新建文件夹
                <input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  maxLength={80}
                  placeholder="例如：2026 · 挪威"
                  disabled={busy}
                  required
                />
              </label>
              <button disabled={busy || !newFolder.trim()}>
                创建文件夹 ＋
              </button>
            </form>
            {activeFolder && (
              <details>
                <summary>管理此文件夹</summary>
                <label>
                  文件夹名称
                  <input
                    value={rename}
                    onChange={(e) => setRename(e.target.value)}
                    maxLength={80}
                    disabled={busy}
                  />
                </label>
                <button
                  disabled={busy || !rename.trim()}
                  onClick={() =>
                    void run(async () => {
                      await photoApi(
                        config.apiUrl,
                        token,
                        `/admin/library/folders/${activeFolder.id}/rename`,
                        { name: rename },
                      );
                      await onRefresh();
                      setMessage("文件夹已重命名。");
                    })
                  }
                >
                  保存名称
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !(await confirmation.confirm({
                        title: "删除空文件夹？",
                        description: "有照片（含回收站照片）的文件夹不能删除。",
                        action: "删除空文件夹",
                      }))
                    )
                      return;
                    void run(async () => {
                      await photoApi(
                        config.apiUrl,
                        token,
                        `/admin/library/folders/${activeFolder.id}/delete`,
                        {},
                      );
                      await onRefresh();
                      changeFolder("all");
                    });
                  }}
                >
                  删除空文件夹
                </button>
              </details>
            )}
            <p>
              文件夹是照片库分类。R2
              使用稳定的照片目录，改名或移动分类不会复制大文件。
            </p>
          </aside>
        )}
        <div className="library-content">
          {!trash && (
            <div className="library-ingest">
              <label
                className="library-upload"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void upload(event.dataTransfer.files);
                }}
              >
                <strong>上传到{activeFolder?.name || "未分类"} ＋</strong>
                <span>JPEG / PNG / WebP · 每张最多 64MiB · 拖放或批量选择</span>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) => void upload(event.target.files)}
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await photoApi<{ message: string }>(
                      config.apiUrl,
                      token,
                      "/admin/process",
                      {},
                    );
                    await onRefresh();
                    setMessage(result.message);
                  })
                }
              >
                处理待办 ↗
              </button>
            </div>
          )}
          {progress && (
            <div className="manager-progress">
              <span>{progress.name}</span>
              <progress
                value={progress.value}
                max={1}
                aria-label="照片库上传进度"
              />
              <button onClick={() => abort.current?.abort()}>暂停上传</button>
            </div>
          )}
          <div className="library-filters">
            <label>
              查找照片
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected([]);
                  setLimit(40);
                }}
                placeholder="文件名或相机"
                disabled={busy}
              />
            </label>
            <label>
              状态
              <select
                value={filter}
                disabled={busy}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setSelected([]);
                  setLimit(40);
                }}
              >
                <option value="all">全部状态</option>
                <option value="ready">已处理</option>
                <option value="pending">待处理 / 失败</option>
                <option value="unused">未加入旅行</option>
              </select>
            </label>
            <button
              disabled={busy || !visible.length}
              onClick={() =>
                setSelected(visible.slice(0, 40).map((photo) => photo.id))
              }
            >
              选择本页（最多 40 张）
            </button>
            <button
              disabled={busy || !selected.length}
              onClick={() => setSelected([])}
            >
              取消选择
            </button>
          </div>
          {selected.length > 0 && (
            <div className="library-selection" aria-label="已选照片操作">
              <strong>已选 {selected.length} 张</strong>
              {trash ? (
                <button
                  disabled={busy || picked.some((photo) => photo.purging)}
                  onClick={() => void bulk("restore")}
                >
                  恢复所选照片
                </button>
              ) : (
                <>
                  <label>
                    加入旅行
                    <select
                      value={targetTrip}
                      disabled={busy}
                      onChange={(event) => setTargetTrip(event.target.value)}
                    >
                      <option value="">请选择旅行</option>
                      {trips.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="travel-button"
                    disabled={busy || !allReady || !targetTrip}
                    onClick={() =>
                      void run(async () => {
                        await photoApi(
                          config.apiUrl,
                          token,
                          `/admin/albums/${targetTrip}/photos/add`,
                          { photoIds: selected },
                        );
                        await onRefresh();
                        setSelected([]);
                        onAttached(targetTrip);
                      })
                    }
                  >
                    加入这次旅行 ↗
                  </button>
                  <label>
                    移动分类
                    <select
                      value={moveTo}
                      disabled={busy}
                      onChange={(event) => setMoveTo(event.target.value)}
                    >
                      <option value="">未分类</option>
                      {state.folders?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={busy} onClick={() => void bulk("move")}>
                    移动
                  </button>
                  <button
                    className="library-danger"
                    disabled={busy}
                    onClick={() => void bulk("trash")}
                  >
                    移入回收站
                  </button>
                  {!allReady && <small>只有处理完成的照片可以加入旅行。</small>}
                </>
              )}
            </div>
          )}
          <p className="library-count">
            {matching.length} 张{trash ? "已移除的照片" : "照片"} · 原片{" "}
            {formatBytes(state.usedBytes)} · 展示文件{" "}
            {formatBytes(state.derivedBytes || 0)}
          </p>
          {matching.length === 0 && (
            <div className="library-empty">
              {trash
                ? "照片回收站是空的。"
                : "这里还没有照片。可以上传，或调整筛选条件。"}
            </div>
          )}
          <div className="library-grid">
            {visible.map((photo) => (
              <article
                className="library-card"
                key={photo.id}
                data-selected={selected.includes(photo.id)}
              >
                <div className="library-card-image">
                  <button
                    className="library-preview"
                    disabled={
                      busy || photo.state !== "ready" || !!photo.purging
                    }
                    onClick={() => setPreviewId(photo.id)}
                    aria-label={`高清预览 ${photo.filename}`}
                  >
                    {photo.thumbnail ? (
                      <img
                        src={`${config.mediaUrl}/${photo.thumbnail}`}
                        alt={photo.filename}
                        loading="lazy"
                        width={photo.width || 400}
                        height={photo.height || 300}
                      />
                    ) : (
                      <span>{photoStatuses[photo.state]}</span>
                    )}
                  </button>
                  <label className="library-check">
                    <input
                      type="checkbox"
                      aria-label={`选择 ${photo.filename}`}
                      checked={selected.includes(photo.id)}
                      disabled={busy || !!photo.purging}
                      onChange={() => toggle(photo.id)}
                    />
                  </label>
                  <span className="library-state">
                    {photo.purging ? "清理未完成" : photoStatuses[photo.state]}
                  </span>
                </div>
                <div className="library-card-copy">
                  <h3 title={photo.filename}>{photo.filename}</h3>
                  <p>
                    {(photo.bytes / 1e6).toFixed(1)} MB ·{" "}
                    {photo.width && photo.height
                      ? `${photo.width} × ${photo.height}`
                      : "等待高清处理"}
                  </p>
                  <p>
                    {uses(photo.id).length
                      ? `用于 ${uses(photo.id).length} 次旅行`
                      : "未加入旅行"}{" "}
                    ·{" "}
                    {state.folders?.find(
                      (folder) => folder.id === photo.folder_id,
                    )?.name || "未分类"}
                  </p>
                  {photo.error && <p className="accent">{photo.error}</p>}
                  <details>
                    <summary>参数与 R2 文件</summary>
                    <PhotoFacts
                      camera={
                        resolveEquipment(
                          photo.rawCamera === undefined
                            ? photo.camera
                            : photo.rawCamera,
                          photo.equipment,
                        ).camera
                      }
                    />
                    <p>
                      原片（私有）<code>originals/{photo.id}/source</code>
                    </p>
                    {photo.revision && (
                      <p>
                        预览 / 缩略图 / 切片
                        <code>
                          photos/{photo.id}/{photo.revision}/
                        </code>
                      </p>
                    )}
                    {uses(photo.id).map((link) => (
                      <span className="library-trip-tag" key={link.album_id}>
                        {trips.find((trip) => trip.id === link.album_id)?.title}
                        {link.published ? " · 已发布" : " · 待发布"}
                      </span>
                    ))}
                  </details>
                  {trash ? (
                    <button
                      className="library-danger"
                      disabled={busy}
                      onClick={() => purge(photo)}
                    >
                      {photo.purging ? "继续永久删除" : "永久删除此照片"}
                    </button>
                  ) : photo.state === "failed" ? (
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
                          await onRefresh();
                          setMessage("已重新排队，请点击处理待办。");
                        })
                      }
                    >
                      重新排队
                    </button>
                  ) : photo.state === "uploading" ? (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        if (
                          !(await confirmation.confirm({
                            title: "取消未完成上传？",
                            description:
                              "清理上传分片并释放额度，已完成的其他照片不会受影响。",
                            action: "确认取消上传",
                          }))
                        )
                          return;
                        void run(async () => {
                          await photoApi(
                            config.apiUrl,
                            token,
                            `/admin/uploads/${photo.id}/abort`,
                            {},
                          );
                          await onRefresh();
                        });
                      }}
                    >
                      取消未完成上传
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {visible.length < matching.length && (
            <button
              className="library-more"
              disabled={busy}
              onClick={() => setLimit((old) => old + 40)}
            >
              显示更多照片 ({matching.length - visible.length})
            </button>
          )}
        </div>
      </div>
      <ConfirmAction
        request={confirmation.request}
        onResolve={confirmation.resolve}
      />
      {preview && (
        <PhotoViewer
          photo={preview}
          mediaBase={config.mediaUrl}
          position={previewIndex}
          count={previewPhotos.length}
          onClose={() => setPreviewId("")}
          onMove={(direction) =>
            setPreviewId(
              previewPhotos[
                (previewIndex + direction + previewPhotos.length) %
                  previewPhotos.length
              ].id,
            )
          }
        />
      )}
    </section>
  );
}
