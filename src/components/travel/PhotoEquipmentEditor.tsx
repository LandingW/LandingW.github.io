"use client";

import { useEffect, useState } from "react";
import { equipmentInput, type CameraEquipment } from "@/lib/photo-metadata";
import EquipmentFields from "./EquipmentFields";

export default function PhotoEquipmentEditor({
  equipment,
  disabled,
  onSave,
  photoId,
  onDirtyChange,
}: {
  equipment: CameraEquipment;
  disabled: boolean;
  onSave: (equipment: CameraEquipment) => Promise<void>;
  photoId?: string;
  onDirtyChange?: (id: string, dirty: boolean) => void;
}) {
  const [value, setValue] = useState(equipment);
  const dirty =
    JSON.stringify(equipmentInput(value)) !==
    JSON.stringify(equipmentInput(equipment));
  useEffect(() => {
    if (photoId) onDirtyChange?.(photoId, dirty);
    return () => {
      if (photoId) onDirtyChange?.(photoId, false);
    };
  }, [dirty, onDirtyChange, photoId]);
  return (
    <details className="photo-equipment-editor">
      <summary>编辑这张照片的设备</summary>
      <p className="manager-help">
        手动填写的型号优先显示，并标注为手动补充。留空则使用 EXIF
        或旅行默认设备， 不修改原片和曝光参数。
      </p>
      <EquipmentFields value={value} onChange={setValue} disabled={disabled} />
      <div className="manager-actions">
        <button
          disabled={disabled || !dirty}
          onClick={() => void onSave(value)}
        >
          保存这张照片的设备
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            setValue({});
            void onSave({});
          }}
        >
          清除手动填写
        </button>
      </div>
    </details>
  );
}
