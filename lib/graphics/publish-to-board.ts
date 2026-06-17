import "server-only";
import { randomUUID } from "crypto";
import { putObjectBytes } from "@/lib/storage/objects";
import { createThumbnail, toPostJpeg } from "@/lib/process/make-thumbnail";
import { storePostReady } from "@/lib/process/make-thumbnail";
import { buildName } from "@/lib/naming";
import { insertReadyPhoto } from "@/lib/db/photos";
import { createAdminClient } from "@/lib/supabase/admin";

// Store the infographic thumbnail in the "thumbnails" bucket keyed by its photo UUID.
// (Mirrors the storeThumbnailById helper in process-photo.ts, which is private to that module.)
async function storeThumbnailById(photoId: string, thumbnail: Buffer): Promise<string> {
  const supabase = createAdminClient();
  const path = `${photoId}.jpg`;
  const { error } = await supabase.storage
    .from("thumbnails")
    .upload(path, thumbnail, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Infographic thumbnail upload failed: ${error.message}`);
  return path;
}

// Publish a generated infographic PNG to the board so it appears in the "Infographic"
// category filter chip alongside normal photos.
//
// Steps:
//   1. PUT the PNG original to MinIO at infographics/<uuid>.png
//   2. Generate a 1000px thumbnail JPEG → store in "thumbnails" bucket
//   3. Generate a 2048px post-ready JPEG → store in "post-ready" bucket
//   4. Build the display name from the user's prompt (INFO-YYYYMMDD-slug.png)
//   5. Insert a ready photos row (drive_placed_at=NULL so the external mirror picks it up)
//
// Returns the new photo id.
export async function publishInfographicToBoard(
  pngBuffer: Buffer,
  prompt: string
): Promise<string> {
  const photoId = randomUUID();

  // MinIO key — flat layout under "infographics/" prefix (separate from user uploads
  // so "uploads/" prefix detection in process-photo.ts never misidentifies these).
  const objectKey = `infographics/${photoId}.png`;

  // 1. PUT original PNG to MinIO.
  await putObjectBytes(objectKey, pngBuffer, "image/png");

  // 2. Thumbnail (1000px JPEG) for the board tile.
  //    createThumbnail handles HEIC conversion — not needed here, but harmless since
  //    PNG always takes the non-HEIC path.
  const thumb = await createThumbnail(pngBuffer);
  const thumbnailPath = await storeThumbnailById(photoId, thumb);

  // 3. Post-ready copy (2048px JPEG) for publish time — avoids a MinIO round-trip later.
  const postJpeg = await toPostJpeg(pngBuffer);
  const postReadyPath = await storePostReady(photoId, postJpeg);

  // 4. Display name: INFO-YYYYMMDD-<slug>.png
  const displayName = buildName({
    prefix: "INFO",
    createdAt: new Date(),
    description: prompt,
    ext: "png",
  });

  // 5. Insert the photos row as "ready" so it immediately shows on the board.
  //    drive_placed_at is left NULL by insertReadyPhoto so the external mirror job
  //    will copy this to Drive/06_Infographic on its next run.
  const newPhotoId = await insertReadyPhoto({
    object_key: objectKey,
    thumbnail_path: thumbnailPath,
    post_ready_path: postReadyPath,
    display_name: displayName,
    drive_name: displayName,
    category: "infographic",
    tags: ["infographic"],
  });

  return newPhotoId;
}
