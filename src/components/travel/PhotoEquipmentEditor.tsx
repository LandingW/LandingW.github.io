"use client";

import { useState } from "react";
import type { CameraEquipment } from "@/lib/photo-metadata";
import EquipmentFields from "./EquipmentFields";

export default function PhotoEquipmentEditor({
  equipment,
  disabled,
  onSave,
}: {
  equipment: CameraEquipment;
  disabled: boolean;
  onSave: (equipment: CameraEquipment) => Promise<void>;
}) {
  const [value, setValue] = useState(equipment);
  return (
    <details className="photo-equipment-editor">
      <summary>补充 / 修正这张照片的设备</summary>
      <p className="manager-help">
        手动填写会标注来源，并优先于这张照片的自动设备名称。曝光参数仍保留原
        EXIF；留空则恢复自动读取或旅行默认设备。
      </p>
      <EquipmentFields value={value} onChange={setValue} disabled={disabled} />
      <div className="manager-actions">
        <button disabled={disabled} onClick={() => void onSave(value)}>
          保存这张照片的设备
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            setValue({});
            void onSave({});
          }}
        >
          清除手动覆盖
        </button>
      </div>
    </details>
  );
}
