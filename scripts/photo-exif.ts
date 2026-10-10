import exifr from "exifr";
import sharp from "sharp";
import {
  normalizePhotoMetadata,
  type PhotoMetadata,
} from "../src/lib/photo-metadata";

const fields = [
  "Make",
  "Model",
  "LensModel",
  "FocalLength",
  "FocalLengthIn35mmFormat",
  "FNumber",
  "ExposureTime",
  "ISO",
  "DateTimeOriginal",
  "OffsetTimeOriginal",
];

export async function readExifBlock(
  exif: Buffer | undefined,
): Promise<PhotoMetadata> {
  if (!exif || exif.length > 1024 * 1024) return { camera: null, gps: null };
  const data =
    exif.subarray(0, 6).toString("binary") === "Exif\0\0"
      ? exif.subarray(6)
      : exif;
  try {
    const [tagResult, gpsResult] = await Promise.allSettled([
      exifr.parse(data, {
        pick: fields,
        reviveValues: false,
        translateValues: false,
        xmp: false,
        icc: false,
        iptc: false,
        ifd1: false,
      }),
      exifr.gps(data),
    ]);
    const tags = tagResult.status === "fulfilled" ? tagResult.value : undefined;
    const gps = gpsResult.status === "fulfilled" ? gpsResult.value : undefined;
    return normalizePhotoMetadata({
      camera: tags
        ? {
            make: tags.Make,
            model: tags.Model,
            lens: tags.LensModel,
            focalLength: tags.FocalLength,
            focalLength35: tags.FocalLengthIn35mmFormat,
            fNumber: tags.FNumber,
            exposureTime: tags.ExposureTime,
            iso: tags.ISO,
            capturedAt: tags.DateTimeOriginal,
            utcOffset: tags.OffsetTimeOriginal,
          }
        : null,
      gps,
    });
  } catch {
    // EXIF is optional. Never log raw metadata, source paths, GPS or maker notes.
    return { camera: null, gps: null };
  }
}

export async function readPhotoMetadata(input: string): Promise<PhotoMetadata> {
  const metadata = await sharp(input, {
    limitInputPixels: 200_000_000,
  }).metadata();
  return readExifBlock(metadata.exif);
}
