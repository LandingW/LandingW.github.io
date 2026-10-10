export interface CameraMetadata {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: number;
  focalLength35?: number;
  fNumber?: number;
  exposureTime?: number;
  iso?: number;
  capturedAt?: string;
  utcOffset?: string;
}
export interface PhotoLocation {
  latitude: number;
  longitude: number;
}
export interface PhotoMetadata {
  camera: CameraMetadata | null;
  gps: PhotoLocation | null;
}

export function normalizeLocation(value: unknown): PhotoLocation | null {
  if (!value || typeof value !== "object") return null;
  const { latitude, longitude } = value as Record<string, unknown>;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return { latitude, longitude };
}

export function captureDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value
    .trim()
    .match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const date = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
  const milliseconds = Date.parse(`${date}Z`);
  // Validate the wall-clock fields, but do not assign a timezone to the photo.
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString().slice(0, 19) === date
    ? date
    : undefined;
}

export function normalizeCamera(value: unknown): CameraMetadata | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>,
    result: CameraMetadata = {};
  for (const key of ["make", "model", "lens"] as const) {
    if (typeof input[key] === "string") {
      const text = input[key]
        .replace(/[\x00-\x1f\x7f]/g, " ")
        .trim()
        .slice(0, key === "lens" ? 180 : 100);
      if (text) result[key] = text;
    }
  }
  for (const [key, min, max] of [
    ["focalLength", 0.1, 10000],
    ["focalLength35", 1, 10000],
    ["fNumber", 0.1, 1024],
    ["exposureTime", 0.000000001, 86400],
    ["iso", 1, 10000000],
  ] as const) {
    const number = input[key];
    if (
      typeof number === "number" &&
      Number.isFinite(number) &&
      number >= min &&
      number <= max
    )
      result[key] = number;
  }
  const date = captureDate(input.capturedAt);
  if (date) result.capturedAt = date;
  if (
    typeof input.utcOffset === "string" &&
    /^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/.test(input.utcOffset)
  )
    result.utcOffset = input.utcOffset;
  return Object.keys(result).length ? result : null;
}

export function normalizePhotoMetadata(value: unknown): PhotoMetadata {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    camera: normalizeCamera(input.camera),
    gps: normalizeLocation(input.gps),
  };
}

export function cameraFromJson(
  value: string | null | undefined,
): CameraMetadata | null {
  try {
    return normalizeCamera(JSON.parse(value || "null"));
  } catch {
    return null;
  }
}

export function cameraName(camera: CameraMetadata | null | undefined): string {
  if (!camera) return "";
  if (!camera.make) return camera.model || "";
  if (!camera.model) return camera.make;
  return camera.model.toLowerCase().startsWith(camera.make.toLowerCase())
    ? camera.model
    : `${camera.make} ${camera.model}`;
}

const decimal = (number: number) => Number(number.toFixed(2)).toString();
export function exposureLabel(seconds: number): string {
  if (seconds >= 1) return `${decimal(seconds)} s`;
  const denominator = 1 / seconds,
    rounded = Math.round(denominator);
  return Math.abs(denominator - rounded) / denominator < 0.005
    ? `1/${rounded} s`
    : `${Number(seconds.toPrecision(3))} s`;
}
export function cameraFacts(
  camera: CameraMetadata | null | undefined,
): { label: string; value: string }[] {
  if (!camera) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string) => {
    if (value) rows.push({ label, value });
  };
  add("机身", cameraName(camera));
  add("镜头", camera.lens || "");
  if (camera.focalLength)
    add(
      "焦距",
      `${decimal(camera.focalLength)} mm${camera.focalLength35 ? `（35mm 等效 ${decimal(camera.focalLength35)} mm）` : ""}`,
    );
  else if (camera.focalLength35)
    add("35mm 等效焦距", `${decimal(camera.focalLength35)} mm`);
  if (camera.fNumber) add("光圈", `f/${decimal(camera.fNumber)}`);
  if (camera.exposureTime) add("快门", exposureLabel(camera.exposureTime));
  if (camera.iso) add("ISO", decimal(camera.iso));
  if (camera.capturedAt)
    add(
      "拍摄时间",
      `${camera.capturedAt.replace("T", " ")}${camera.utcOffset ? ` UTC${camera.utcOffset}` : "（相机时间，未记录时区）"}`,
    );
  return rows;
}

export function shootingSummary(
  camera: CameraMetadata | null | undefined,
): string {
  return cameraFacts(camera)
    .filter((row) => ["焦距", "光圈", "快门", "ISO"].includes(row.label))
    .map((row) => (row.label === "ISO" ? `ISO ${row.value}` : row.value))
    .join(" · ");
}
