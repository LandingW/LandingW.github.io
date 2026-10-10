export interface CameraMetadata {
  make?: string;
  model?: string;
  lens?: string;
  lensMake?: string;
  lensSpec?: LensSpecification;
  focalLength?: number;
  focalLength35?: number;
  fNumber?: number;
  exposureTime?: number;
  iso?: number;
  capturedAt?: string;
  utcOffset?: string;
}
export interface LensSpecification {
  minFocal: number;
  maxFocal: number;
  minAperture?: number;
  maxAperture?: number;
}
export interface CameraEquipment {
  make?: string;
  model?: string;
  lensMake?: string;
  lens?: string;
}
export interface EquipmentSources {
  camera: "exif" | "photo" | "trip" | null;
  lens: "exif" | "photo" | "trip" | null;
}

export function normalizeLensSpecification(
  value: unknown,
): LensSpecification | undefined {
  const v = Array.isArray(value)
    ? {
        minFocal: value[0],
        maxFocal: value[1],
        minAperture: value[2],
        maxAperture: value[3],
      }
    : value;
  if (!v || typeof v !== "object") return undefined;
  const input = v as Record<string, unknown>,
    min = input.minFocal,
    max = input.maxFocal;
  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min <= 0 ||
    max < min ||
    max > 10000
  )
    return undefined;
  const result: LensSpecification = { minFocal: min, maxFocal: max };
  for (const key of ["minAperture", "maxAperture"] as const) {
    const n = input[key];
    if (typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 1024)
      result[key] = n;
  }
  return result;
}

export function equipmentInput(value: unknown): CameraEquipment {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("设备信息格式不正确");
  const input = value as Record<string, unknown>,
    output: CameraEquipment = {};
  for (const key of ["make", "model", "lensMake", "lens"] as const) {
    const raw = input[key];
    if (raw !== undefined && raw !== null && typeof raw !== "string")
      throw new Error("设备型号必须是文字");
    if (typeof raw === "string") {
      const text = raw.replace(/[\x00-\x1f\x7f]/g, " ").trim();
      if (text.length > (key === "lens" ? 180 : 100))
        throw new Error("设备型号长度超出限制");
      if (text) output[key] = text;
    }
  }
  return output;
}
export function equipmentFromJson(value: unknown): CameraEquipment {
  try {
    return equipmentInput(
      typeof value === "string" ? JSON.parse(value) : value,
    );
  } catch {
    return {};
  }
}

export function resolveEquipment(
  exif: CameraMetadata | null,
  photo: CameraEquipment = {},
  trip: CameraEquipment = {},
): { camera: CameraMetadata | null; equipmentSources: EquipmentSources } {
  const camera: CameraMetadata = { ...exif },
    equipmentSources: EquipmentSources = { camera: null, lens: null };
  const body =
    photo.make || photo.model ? photo : exif?.make || exif?.model ? exif : trip;
  if (body?.make || body?.model) {
    delete camera.make;
    delete camera.model;
    if (body.make) camera.make = body.make;
    if (body.model) camera.model = body.model;
    equipmentSources.camera =
      body === photo ? "photo" : body === exif ? "exif" : "trip";
  }
  const lens =
    photo.lens || photo.lensMake
      ? photo
      : exif?.lens || exif?.lensMake
        ? exif
        : trip;
  if (lens?.lens || lens?.lensMake) {
    delete camera.lens;
    delete camera.lensMake;
    if (lens.lens) camera.lens = lens.lens;
    if (lens.lensMake) camera.lensMake = lens.lensMake;
    equipmentSources.lens =
      lens === photo ? "photo" : lens === exif ? "exif" : "trip";
  }
  return { camera: normalizeCamera(camera), equipmentSources };
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
  for (const key of ["make", "model", "lens", "lensMake"] as const) {
    if (typeof input[key] === "string") {
      const text = input[key]
        .replace(/[\x00-\x1f\x7f]/g, " ")
        .trim()
        .slice(0, key === "lens" ? 180 : 100);
      if (text) result[key] = text;
    }
  }
  const lensSpec = normalizeLensSpecification(input.lensSpec);
  if (lensSpec) result.lensSpec = lensSpec;
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

export function lensName(camera: CameraMetadata | null | undefined): string {
  if (!camera) return "";
  if (!camera.lensMake) return camera.lens || "";
  if (!camera.lens) return camera.lensMake;
  return camera.lens.toLowerCase().startsWith(camera.lensMake.toLowerCase())
    ? camera.lens
    : `${camera.lensMake} ${camera.lens}`;
}

export function lensSpecificationLabel(spec: LensSpecification): string {
  const focal =
    spec.minFocal === spec.maxFocal
      ? `${decimal(spec.minFocal)} mm`
      : `${decimal(spec.minFocal)}–${decimal(spec.maxFocal)} mm`;
  if (!spec.minAperture) return focal;
  return `${focal} f/${decimal(spec.minAperture)}${spec.maxAperture && spec.maxAperture !== spec.minAperture ? `–${decimal(spec.maxAperture)}` : ""}`;
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
  sources?: EquipmentSources,
): { label: string; value: string; source?: string }[] {
  if (!camera) return [];
  const rows: { label: string; value: string; source?: string }[] = [];
  const add = (label: string, value: string, source?: string) => {
    if (value) rows.push({ label, value, ...(source ? { source } : {}) });
  };
  const provenance = (source: EquipmentSources["camera"] | undefined) =>
    source === "photo"
      ? "手动补录"
      : source === "trip"
        ? "旅行默认"
        : undefined;
  add("机身", cameraName(camera), provenance(sources?.camera));
  add("镜头", lensName(camera), provenance(sources?.lens));
  if (camera.lensSpec)
    add("镜头规格", lensSpecificationLabel(camera.lensSpec), "EXIF");
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
