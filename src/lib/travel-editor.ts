import type { TravelAlbum } from "./travel";
import { equipmentInput, type CameraEquipment } from "./photo-metadata";

export function albumForm(album?: TravelAlbum) {
  return {
    title: album?.title || "",
    description: album?.description || "",
    place: album?.place || "",
    date: album?.date || "",
    latitude: album?.latitude == null ? "" : String(album.latitude),
    longitude: album?.longitude == null ? "" : String(album.longitude),
    googlePlaceId: album?.googlePlaceId || null,
    coverPhotoIds: album?.coverPhotoIds || [],
    equipmentDefaults: album?.equipmentDefaults || ({} as CameraEquipment),
    stops: album?.stops || [],
  };
}
export type AlbumForm = ReturnType<typeof albumForm>;

export function formFingerprint(form: AlbumForm) {
  // Fixed key order; empty optional equipment fields do not create false edits.
  return JSON.stringify({
    ...albumForm(),
    ...form,
    equipmentDefaults: equipmentInput(form.equipmentDefaults),
  });
}

export function moveCover(ids: string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id),
    target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function publicationCheck(
  photos: { state: string; published: number }[],
  dirty: boolean,
) {
  const ready = photos.filter((photo) => photo.state === "ready").length;
  const unfinished = photos.length - ready;
  return {
    ready,
    unfinished,
    canPublish: ready > 0 && unfinished === 0 && !dirty,
  };
}
