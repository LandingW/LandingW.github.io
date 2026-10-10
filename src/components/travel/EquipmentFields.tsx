import type { CameraEquipment } from "@/lib/photo-metadata";

export default function EquipmentFields({
  value,
  onChange,
  disabled = false,
}: {
  value: CameraEquipment;
  onChange: (value: CameraEquipment) => void;
  disabled?: boolean;
}) {
  return (
    <div className="equipment-fields">
      <div className="manager-fields">
        <label>
          相机品牌
          <input
            disabled={disabled}
            value={value.make || ""}
            onChange={(event) =>
              onChange({ ...value, make: event.target.value })
            }
            maxLength={100}
            placeholder="品牌，可留空"
          />
        </label>
        <label>
          相机型号
          <input
            disabled={disabled}
            value={value.model || ""}
            onChange={(event) =>
              onChange({ ...value, model: event.target.value })
            }
            maxLength={100}
            placeholder="填写实际机身型号"
          />
        </label>
      </div>
      <div className="manager-fields">
        <label>
          镜头品牌
          <input
            disabled={disabled}
            value={value.lensMake || ""}
            onChange={(event) =>
              onChange({ ...value, lensMake: event.target.value })
            }
            maxLength={100}
            placeholder="品牌，可留空"
          />
        </label>
        <label>
          镜头型号
          <input
            disabled={disabled}
            value={value.lens || ""}
            onChange={(event) =>
              onChange({ ...value, lens: event.target.value })
            }
            maxLength={180}
            placeholder="填写实际镜头型号"
          />
        </label>
      </div>
    </div>
  );
}
