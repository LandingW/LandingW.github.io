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
        <p className="eyebrow">03 / BEHIND THE FRAME</p>
        <h2 id="equipment-title">
          光线背后<span className="accent">.</span>
        </h2>
        <p>相机、镜头，以及按下快门的方式。</p>
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
            <dt>CAMERA / 机身</dt>
            <dd>{bodies.join(" / ") || "机身型号未记录"}</dd>
          </div>
          <div>
            <dt>LENS / 镜头</dt>
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
          范围来自本次照片中已记录的参数。型号显示 EXIF
          或已补录的信息；镜头规格不等于镜头型号。每张照片的完整参数可在高清查看器中查看。
        </p>
      </div>
    </section>
  );
}
