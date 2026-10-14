import {
  cameraName,
  lensName,
  lensSpecificationLabel,
  exposureLabel,
} from "@/lib/photo-metadata";
import type { TravelPhoto } from "@/lib/travel";

function range(values: (number | undefined)[], format: (n: number) => string) {
  const valid = values.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0,
  );
  if (!valid.length) return "未记录";
  const min = Math.min(...valid),
    max = Math.max(...valid);
  return min === max ? format(min) : `${format(min)} — ${format(max)}`;
}

export default function TripEquipment({ photos }: { photos: TravelPhoto[] }) {
  const bodies = [
    ...new Set(photos.map((photo) => cameraName(photo.camera)).filter(Boolean)),
  ];
  const lenses = [
    ...new Set(photos.map((photo) => lensName(photo.camera)).filter(Boolean)),
  ];
  const specifications = [
    ...new Set(
      photos.flatMap((photo) =>
        photo.camera?.lensSpec
          ? [lensSpecificationLabel(photo.camera.lensSpec)]
          : [],
      ),
    ),
  ];
  const stats = [
    [
      "焦距",
      range(
        photos.map((p) => p.camera?.focalLength),
        (n) => `${n} mm`,
      ),
    ],
    [
      "光圈",
      range(
        photos.map((p) => p.camera?.fNumber),
        (n) => `f/${n}`,
      ),
    ],
    [
      "快门",
      range(
        photos.map((p) => p.camera?.exposureTime),
        exposureLabel,
      ),
    ],
    [
      "感光度",
      range(
        photos.map((p) => p.camera?.iso),
        (n) => `ISO ${n}`,
      ),
    ],
  ];
  return (
    <section
      id="story-equipment"
      className="journey-equipment journey-section"
      aria-labelledby="equipment-title"
      data-reveal
    >
      <div className="journey-equipment-intro">
        <p className="eyebrow">03 / EQUIPMENT</p>
        <h2 id="equipment-title">
          拍摄设备<span className="accent">.</span>
        </h2>
        <p>这组照片使用的相机、镜头和拍摄参数。</p>
        <span className="equipment-aperture" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" />
            <path d="M50 6 75 50 63 71 M88 28 50 28 25 50 M88 72 63 28 38 28 M50 94 25 50 38 28 M12 72 50 72 75 50 M12 28 37 72 62 72" />
          </svg>
        </span>
      </div>
      <div className="journey-equipment-data">
        <dl className="journey-device-list">
          <div>
            <dt>相机</dt>
            <dd>{bodies.join(" / ") || "机身型号未记录"}</dd>
          </div>
          <div>
            <dt>镜头</dt>
            <dd>{lenses.join(" / ") || "镜头型号未记录"}</dd>
            {specifications.length > 0 && (
              <dd className="lens-spec-note">
                EXIF 规格 · {specifications.join(" / ")}
              </dd>
            )}
          </div>
        </dl>
        <dl className="journey-exposure-list">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="journey-equipment-note">
          参数范围取自这组照片。设备名称来自 EXIF
          或手动补充的信息，镜头规格单独列出。 单张照片的参数可以在大图中查看。
        </p>
      </div>
    </section>
  );
}
