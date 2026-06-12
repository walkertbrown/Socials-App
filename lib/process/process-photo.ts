import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDriveFile } from "@/lib/drive/fetch-file";
import { createThumbnail, storeThumbnail } from "@/lib/process/make-thumbnail";
import { hashAndGroup } from "@/lib/process/perceptual-hash";
import { tagPhoto } from "@/lib/process/vision-tag";

export interface ProcessResult {
  id: string;
  status: "ready";
  tag?: string;
  skipped?: boolean;
}

// Processes exactly ONE photo. Designed to run in a single serverless
// invocation so a large import never times out — the client calls this
// once per photo, sequentially.
export async function processOnePhoto(photoId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();

  const { data: photo } = await supabase
    .from("photos")
    .select("id, drive_file_id, status, tags")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) throw new Error("Photo not found");

  // Idempotency guard: if it's already processed, do NO download / resize /
  // vision work. This is what makes a re-sync free instead of re-paying.
  if (photo.status === "ready" && photo.tags) {
    return { id: photoId, status: "ready", skipped: true };
  }

  const original = await fetchDriveFile(photo.drive_file_id);
  const thumb = await createThumbnail(original);
  const thumbnailPath = await storeThumbnail(photo.drive_file_id, thumb);
  const { hash, duplicateGroupId } = await hashAndGroup(thumb);
  const tag = await tagPhoto(thumb);

  await supabase
    .from("photos")
    .update({
      thumbnail_path: thumbnailPath,
      perceptual_hash: hash,
      duplicate_group_id: duplicateGroupId,
      tags: [tag],
      status: "ready",
    })
    .eq("id", photoId);

  return { id: photoId, status: "ready", tag };
}
