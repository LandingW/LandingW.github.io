import type { Env } from "./index";
import { HttpError } from "./http";
import { validId } from "../../../src/lib/travel";

const timestamp = () => new Date().toISOString();
function selection(value: unknown, maximum = 40): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > maximum ||
    value.some((id) => !validId(id)) ||
    new Set(value).size !== value.length
  )
    throw new HttpError(400, `请选择 1–${maximum} 张不重复的照片`);
  return value;
}
function folderName(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 80 ||
    /[\x00-\x1f]/.test(value)
  )
    throw new HttpError(400, "文件夹名称需为 1–80 个字符");
  return value.trim();
}
const slots = (ids: string[]) => ids.map(() => "?").join(",");
export async function syncPublishedFlags(env: Env) {
  await env.DB.prepare(
    "UPDATE photos SET published=CASE WHEN deleted_at IS NULL AND EXISTS(SELECT 1 FROM album_photos ap JOIN albums a ON a.id=ap.album_id WHERE ap.photo_id=photos.id AND ap.published=1 AND a.published=1 AND a.deleted_at IS NULL) THEN 1 ELSE 0 END",
  ).run();
}
export async function requireFolder(env: Env, id: unknown) {
  if (id === null || id === undefined || id === "") return null;
  if (
    !validId(id) ||
    !(await env.DB.prepare("SELECT id FROM photo_folders WHERE id=?")
      .bind(id)
      .first())
  )
    throw new HttpError(404, "文件夹不存在，请刷新照片库");
  return id;
}
export async function requireTrip(env: Env, id: string, includeTrash = false) {
  const row = await env.DB.prepare(
    `SELECT id,deleted_at FROM albums WHERE id=? AND is_library=0${includeTrash ? "" : " AND deleted_at IS NULL"}`,
  )
    .bind(id)
    .first<{ id: string; deleted_at: string | null }>();
  if (!row) throw new HttpError(404, "旅行不存在或已在回收站中");
  return row;
}

// Called only after admin authentication. R2 keys are always server-derived;
// folder moves change metadata, never accept an arbitrary bucket or object key.
export async function libraryAction(
  path: string,
  input: Record<string, unknown>,
  env: Env,
  publish: () => Promise<unknown>,
): Promise<Record<string, unknown> | null> {
  if (path === "/admin/library/folders") {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO photo_folders(id,name,created_at) VALUES(?,?,?)",
    )
      .bind(id, folderName(input.name), timestamp())
      .run();
    return { id };
  }
  const folder = path.match(
    /^\/admin\/library\/folders\/([\w-]+)\/(rename|delete)$/,
  );
  if (folder) {
    const [, id, action] = folder;
    await requireFolder(env, id);
    if (action === "rename") {
      await env.DB.prepare("UPDATE photo_folders SET name=? WHERE id=?")
        .bind(folderName(input.name), id)
        .run();
    } else {
      await env.DB.prepare(
        "UPDATE photos SET folder_id=NULL WHERE folder_id=? AND state='aborted'",
      )
        .bind(id)
        .run();
      const result = await env.DB.prepare(
        "DELETE FROM photo_folders WHERE id=? AND NOT EXISTS(SELECT 1 FROM photos WHERE folder_id=?)",
      )
        .bind(id, id)
        .run();
      if (!result.meta.changes)
        throw new HttpError(409, "文件夹中仍有照片（含回收站），请先移动照片");
    }
    return { ok: true };
  }
  const membership = path.match(
    /^\/admin\/albums\/([\w-]+)\/photos\/(add|remove|reorder)$/,
  );
  if (membership) {
    const [, id, action] = membership;
    await requireTrip(env, id);
    const ids = selection(input.photoIds, action === "reorder" ? 100 : 40),
      marks = slots(ids);
    if (action === "add") {
      const valid = await env.DB.prepare(
        `SELECT id FROM photos WHERE id IN (${marks}) AND state='ready' AND deleted_at IS NULL AND purging=0`,
      )
        .bind(...ids)
        .all();
      if (valid.results.length !== ids.length)
        throw new HttpError(409, "只能加入仍在照片库中、已处理完成的照片");
      await env.DB.batch(
        ids.map((photoId) =>
          env.DB.prepare(
            "INSERT OR IGNORE INTO album_photos(album_id,photo_id,position,published) SELECT ?,id,(SELECT COALESCE(MAX(position),-1)+1 FROM album_photos WHERE album_id=?),0 FROM photos WHERE id=? AND state='ready' AND deleted_at IS NULL",
          ).bind(id, id, photoId),
        ),
      );
    } else if (action === "remove") {
      await env.DB.batch([
        env.DB.prepare(
          `DELETE FROM album_photos WHERE album_id=? AND photo_id IN (${marks})`,
        ).bind(id, ...ids),
        env.DB.prepare(
          `UPDATE albums SET cover_photo_ids=(SELECT json_group_array(value) FROM json_each(albums.cover_photo_ids) WHERE value NOT IN (${marks})) WHERE id=?`,
        ).bind(...ids, id),
      ]);
    } else {
      const existing = await env.DB.prepare(
        "SELECT ap.photo_id FROM album_photos ap JOIN photos p ON p.id=ap.photo_id WHERE ap.album_id=? AND p.deleted_at IS NULL",
      )
        .bind(id)
        .all<{ photo_id: string }>();
      if (
        existing.results.length !== ids.length ||
        existing.results.some((row) => !ids.includes(row.photo_id))
      )
        throw new HttpError(409, "旅行照片已发生变化，请刷新后重新排序");
      await env.DB.batch(
        ids.map((photoId, position) =>
          env.DB.prepare(
            "UPDATE album_photos SET position=? WHERE album_id=? AND photo_id=?",
          ).bind(position, id, photoId),
        ),
      );
    }
    await syncPublishedFlags(env);
    await publish();
    return { ok: true };
  }
  const trip = path.match(/^\/admin\/albums\/([\w-]+)\/(trash|restore)$/);
  if (trip) {
    const [, id, action] = trip;
    await requireTrip(env, id, true);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE albums SET deleted_at=?,published=0 WHERE id=? AND is_library=0",
      ).bind(action === "trash" ? timestamp() : null, id),
      env.DB.prepare(
        "UPDATE album_photos SET published=0 WHERE album_id=?",
      ).bind(id),
    ]);
    await syncPublishedFlags(env);
    await publish();
    return { ok: true };
  }
  const bulk = path.match(/^\/admin\/library\/photos\/(move|trash|restore)$/);
  if (bulk) {
    const action = bulk[1],
      ids = selection(input.photoIds),
      marks = slots(ids);
    const rows = await env.DB.prepare(
      `SELECT id,state,metadata_state,deleted_at,purging FROM photos WHERE id IN (${marks}) AND state!='aborted'`,
    )
      .bind(...ids)
      .all<{
        id: string;
        state: string;
        metadata_state: string;
        deleted_at: string | null;
        purging: number;
      }>();
    if (rows.results.length !== ids.length)
      throw new HttpError(404, "部分照片已不存在，请刷新");
    if (rows.results.some((row) => row.purging))
      throw new HttpError(409, "部分照片正在永久删除，不能修改或恢复");
    if (action === "move") {
      if (rows.results.some((row) => row.deleted_at))
        throw new HttpError(409, "请先从回收站恢复照片");
      const folderId = await requireFolder(env, input.folderId);
      await env.DB.prepare(
        `UPDATE photos SET folder_id=? WHERE id IN (${marks}) AND deleted_at IS NULL AND purging=0`,
      )
        .bind(folderId, ...ids)
        .run();
    } else if (action === "trash") {
      if (
        rows.results.some(
          (row) =>
            ["uploading", "processing"].includes(row.state) ||
            row.metadata_state === "processing",
        )
      )
        throw new HttpError(
          409,
          "请先完成或取消上传，并等待正在处理的照片完成",
        );
      const result = await env.DB.prepare(
        `UPDATE photos SET deleted_at=?,published=0 WHERE id IN (${marks}) AND purging=0 AND NOT EXISTS(SELECT 1 FROM photos WHERE id IN (${marks}) AND (state IN ('uploading','processing') OR metadata_state='processing'))`,
      )
        .bind(timestamp(), ...ids, ...ids)
        .run();
      if (!result.meta.changes)
        throw new HttpError(409, "照片已开始处理，请稍后再试");
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE album_photos SET published=0 WHERE photo_id IN (${marks})`,
        ).bind(...ids),
        env.DB.prepare(
          `UPDATE albums SET cover_photo_ids=(SELECT json_group_array(value) FROM json_each(albums.cover_photo_ids) WHERE value NOT IN (${marks}))`,
        ).bind(...ids),
      ]);
    } else {
      await env.DB.prepare(
        `UPDATE photos SET deleted_at=NULL WHERE id IN (${marks}) AND purging=0`,
      )
        .bind(...ids)
        .run();
      // Existing links remain drafts; restoring a file never republishes it.
    }
    if (action !== "move") {
      await syncPublishedFlags(env);
      await publish();
    }
    return { ok: true };
  }
  const purge = path.match(/^\/admin\/library\/photos\/([\w-]+)\/purge$/);
  if (purge) {
    const id = purge[1];
    if (input.confirm !== id)
      throw new HttpError(400, "请明确确认要永久删除的照片");
    const row = await env.DB.prepare(
      "SELECT original_key,deleted_at FROM photos WHERE id=?",
    )
      .bind(id)
      .first<{ original_key: string; deleted_at: string | null }>();
    if (!row) return { ok: true, done: true };
    if (!row.deleted_at) throw new HttpError(409, "请先将照片移入回收站");
    if (row.original_key !== `originals/${id}/source`)
      throw new HttpError(409, "原片路径异常，已停止删除");
    const reserved = await env.DB.prepare(
      "UPDATE photos SET purging=1 WHERE id=? AND deleted_at IS NOT NULL",
    )
      .bind(id)
      .run();
    if (!reserved.meta.changes)
      throw new HttpError(409, "照片已恢复，已停止删除");
    // Bounded, resumable deletion. No broad bucket delete and no client keys.
    const page = await env.PUBLIC.list({ prefix: `photos/${id}/`, limit: 400 });
    if (page.objects.length)
      await env.PUBLIC.delete(page.objects.map((object) => object.key));
    if (page.truncated) return { ok: true, done: false };
    await env.ORIGINALS.delete(row.original_key);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM album_photos WHERE photo_id=?").bind(id),
      env.DB.prepare("DELETE FROM photos WHERE id=? AND purging=1").bind(id),
    ]);
    return { ok: true, done: true };
  }
  return null;
}
