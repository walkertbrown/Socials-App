import "server-only";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "thumbnails";

// Resize an original down to a small (~100-200 KB) JPEG. Honors EXIF rotation.
export async function createThumbnail(original: Buffer): Promise<Buffer> {
  return sharp(original)
    .rotate()
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
}

// Store ONLY the thumbnail in Supabase (never the original).
export async function storeThumbnail(
  driveFileId: string,
  thumbnail: Buffer
): Promise<string> {
  const path = `${driveFileId}.jpg`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, thumbnail, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Thumbnail upload failed: ${error.message}`);
  return path;
}
