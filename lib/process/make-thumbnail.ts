import "server-only";
import sharp from "sharp";
import heicConvert from "heic-convert";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "thumbnails";

// HEIC/HEIF is iPhone's default photo format, and sharp's prebuilt binary can't
// decode it — so detect those by their file signature and convert to JPEG first.
function isHeic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12).toLowerCase();
  return ["heic", "heix", "heif", "mif1", "msf1", "hevc", "heim", "heis", "hevm", "hevs"].includes(brand);
}

// Resize an original down to a small (~100-200 KB) JPEG. Honors EXIF rotation.
export async function createThumbnail(original: Buffer): Promise<Buffer> {
  let input = original;
  if (isHeic(original)) {
    input = Buffer.from(await heicConvert({ buffer: original, format: "JPEG", quality: 0.92 }));
  }
  return sharp(input)
    .rotate()
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
}

// Store ONLY the thumbnail in Supabase (never the original).
export async function storeThumbnail(driveFileId: string, thumbnail: Buffer): Promise<string> {
  const path = `${driveFileId}.jpg`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, thumbnail, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Thumbnail upload failed: ${error.message}`);
  return path;
}
