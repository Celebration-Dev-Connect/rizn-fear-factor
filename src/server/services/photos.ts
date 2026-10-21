import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { config } from "../config";
import { AppError } from "../middleware/errors";

export type PhotoSize = "thumb" | "full";
const PIXELS: Record<PhotoSize, number> = { full: 1200, thumb: 480 };
const QUALITY: Record<PhotoSize, number> = { full: 75, thumb: 70 };

export function photoPath(photoId: string, size: PhotoSize): string {
  return path.join(config().PHOTO_DIR, `${photoId}-${PIXELS[size]}.webp`);
}

/**
 * Re-encodes an upload into two WebP files with all metadata stripped (no EXIF/GPS/XMP —
 * sharp drops metadata unless withMetadata() is called). Orientation is applied first.
 */
export async function processUpload(buffer: Buffer): Promise<string> {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new AppError("unsupported_media", 415, "That file isn't a photo");
  }
  if (!meta.format || !["jpeg", "png", "webp", "heif", "avif"].includes(meta.format)) {
    throw new AppError("unsupported_media", 415, "That file isn't a supported photo");
  }
  const photoId = randomUUID();
  await fs.mkdir(config().PHOTO_DIR, { recursive: true });
  for (const size of ["full", "thumb"] as const) {
    await sharp(buffer)
      .rotate()
      .resize({ width: PIXELS[size], height: PIXELS[size], fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY[size] })
      .toFile(photoPath(photoId, size));
  }
  return photoId;
}

export async function deletePhoto(photoId: string): Promise<void> {
  await Promise.all(
    (["full", "thumb"] as const).map((s) => fs.rm(photoPath(photoId, s), { force: true })),
  );
}

export function photoUrls(photoId: string) {
  return { thumb: `/api/photos/${photoId}/thumb`, full: `/api/photos/${photoId}/full` };
}
