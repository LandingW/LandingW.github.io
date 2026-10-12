import type { TravelAlbum } from "./travel";
import {
  resolveEquipment,
  type CameraMetadata,
  type CameraEquipment,
  type PhotoLocation,
  type EquipmentSources,
} from "./photo-metadata";

export const LIBRARY_ALBUM_ID = "photo-library";
export type ManagedAlbum = TravelAlbum & {
  published: number;
  deleted_at?: string | null;
};
export interface PhotoFolder {
  id: string;
  name: string;
  created_at: string;
}
export interface PhotoMembership {
  album_id: string;
  photo_id: string;
  position: number;
  published: number;
}
export interface ManagedPhoto {
  id: string;
  album_id: string; // Upload origin, not the current set of travel memberships.
  filename: string;
  bytes: number;
  state: string;
  error: string | null;
  published: number;
  derived_bytes: number | null;
  camera: CameraMetadata | null;
  rawCamera?: CameraMetadata | null;
  gps: PhotoLocation | null;
  location_mode: "exact" | "hidden";
  metadata_state: string;
  metadata_error: string | null;
  width: number | null;
  height: number | null;
  thumbnail?: string | null;
  revision?: string | null;
  created_at: string;
  equipment: CameraEquipment;
  equipmentSources?: EquipmentSources;
  folder_id?: string | null;
  deleted_at?: string | null;
  purging?: number;
}
export interface LibraryState {
  albums: ManagedAlbum[];
  photos: ManagedPhoto[];
  folders?: PhotoFolder[];
  memberships?: PhotoMembership[];
  usedBytes: number;
  maxBytes: number;
  derivedBytes?: number;
  libraryVersion?: number;
}
export const photoStatuses: Record<string, string> = {
  uploading: "上传未完成",
  queued: "等待处理",
  processing: "正在切片",
  ready: "已处理",
  failed: "处理失败",
};
export function photosForTrip(
  state: LibraryState | null,
  album?: ManagedAlbum,
) {
  if (!state || !album || album.deleted_at) return [];
  const links = state.memberships
    ?.filter((link) => link.album_id === album.id)
    .sort(
      (a, b) => a.position - b.position || a.photo_id.localeCompare(b.photo_id),
    );
  const photos = links
    ? links
        .map((link) => {
          const photo = state.photos.find((p) => p.id === link.photo_id);
          return photo
            ? { ...photo, published: album.published && link.published ? 1 : 0 }
            : undefined;
        })
        .filter((photo): photo is ManagedPhoto => !!photo)
    : state.photos.filter((photo) => photo.album_id === album.id);
  return photos
    .filter((photo) => !photo.deleted_at)
    .map((photo) => ({
      ...photo,
      ...resolveEquipment(
        photo.rawCamera === undefined ? photo.camera : photo.rawCamera,
        photo.equipment,
        album.equipmentDefaults,
      ),
    }));
}
