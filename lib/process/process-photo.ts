import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDriveFile, getMimeType } from "@/lib/drive/fetch-file";
import { createThumbnail, storeThumbnail } from "@/lib/process/make-thumbnail";
import { hashAndGroup } from "@/lib/process/perceptual-hash";
import { analyzePhoto } from "@/lib/process/vision-tag";
import { moveFile } from "@/lib/drive/move-file";
import { makeVideoThumbnail } from "@/lib/process/video-thumbnail";

export interface ProcessResult {
  id: string;
  status: "ready";
  category?: string;
  moved?: boolean;
  skipped?: boolean;
}

// Processes exactly ONE item. Photos: thumbnail -> hash -> categorize -> move.
// Videos: skip all that and just sweep into the Videos folder.
export async function processOnePhoto(photoId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();

  const { data: photo } = await supabase
    .from("photos")
    .select("id, drive_file_id, drive_name, status, category")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found");

  // Idempotency: already done -> no download / vision / move work.
  if (photo.status === "ready" && photo.category) {
    return { id: photoId, status: "ready", skipped: true };
  }

  const { data: config } = await supabase
    .from("app_config")
    .select("category_folder_map")
    .eq("id", 1)
    .maybeSingle();
  const folderMap: Record<string, string> = config?.category_folder_map ?? {};

  // Videos: skip the photo pipeline. Pull ONE frame by streaming (never download
  // the whole video) for a preview thumbnail + a search description, then sweep it
  // into the Videos folder. All best-effort — a missing frame won't block the move.
  const mimeType = await getMimeType(photo.drive_file_id);
  if (mimeType.startsWith("video/")) {
    let thumbnailPath: string | null = null;
    let description: string | null = null;
    let tags: string[] = ["videos"];
    try {
      const { path, frame } = await makeVideoThumbnail(photo.drive_file_id);
      thumbnailPath = path;
      const analysis = await analyzePhoto(frame);
      if (analysis.description) description = analysis.description;
      if (analysis.tags.length) tags = analysis.tags;
    } catch {
      /* no ffmpeg / unreadable video — keep going; it just won't be selectable yet */
    }

    let currentFolderId: string | null = null;
    const dest = folderMap["videos"];
    if (dest) {
      try {
        await moveFile(photo.drive_file_id, dest);
        currentFolderId = dest;
      } catch {
        currentFolderId = null;
      }
    }
    await supabase
      .from("photos")
      .update({
        category: "videos",
        current_folder_id: currentFolderId,
        moved_at: currentFolderId ? new Date().toISOString() : null,
        thumbnail_path: thumbnailPath,
        description,
        tags,
        status: "ready",
      })
      .eq("id", photoId);
    return { id: photoId, status: "ready", category: "videos", moved: !!currentFolderId };
  }

  // Photos: the full pipeline.
  const original = await fetchDriveFile(photo.drive_file_id);
  const thumb = await createThumbnail(original);
  const thumbnailPath = await storeThumbnail(photo.drive_file_id, thumb);
  const { hash, duplicateGroupId } = await hashAndGroup(thumb);
  const { category, description, tags } = await analyzePhoto(thumb);

  let currentFolderId: string | null = null;
  const dest = folderMap[category];
  if (dest) {
    try {
      await moveFile(photo.drive_file_id, dest);
      currentFolderId = dest;
    } catch {
      currentFolderId = null;
    }
  }

  await supabase
    .from("photos")
    .update({
      thumbnail_path: thumbnailPath,
      perceptual_hash: hash,
      duplicate_group_id: duplicateGroupId,
      category,
      description,
      current_folder_id: currentFolderId,
      moved_at: currentFolderId ? new Date().toISOString() : null,
      tags: tags.length ? tags : [category],
      status: "ready",
    })
    .eq("id", photoId);

  return { id: photoId, status: "ready", category, moved: !!currentFolderId };
}
