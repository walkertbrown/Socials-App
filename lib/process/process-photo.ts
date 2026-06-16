import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOriginal } from "@/lib/storage/index";
import { createThumbnail, storeThumbnail } from "@/lib/process/make-thumbnail";
import { hashAndGroup } from "@/lib/process/perceptual-hash";
import { analyzePhoto } from "@/lib/process/vision-tag";
import { makeVideoThumbnail } from "@/lib/process/video-thumbnail";
import { buildName, categoryToPrefix } from "@/lib/naming";
import { setDisplayName } from "@/lib/db/photos";

export interface ProcessResult {
  id: string;
  status: "ready" | "pending_review";
  category?: string;
  skipped?: boolean;
}

// Processes exactly ONE item. Photos: thumbnail -> hash -> categorize.
// Videos: preview frame thumbnail + description, then mark ready.
// Organization is DB-only — no object moves happen in MinIO.
export async function processOnePhoto(photoId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();

  const { data: photo } = await supabase
    .from("photos")
    .select(
      "id, drive_file_id, drive_name, object_key, storage_backend, display_name, status, category, created_at"
    )
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found");

  // Idempotency: already processed → skip all heavy work.
  // Both "ready" and "pending_review" count as already processed.
  if ((photo.status === "ready" || photo.status === "pending_review") && photo.category) {
    return { id: photoId, status: photo.status as "ready" | "pending_review", skipped: true };
  }

  // Infer mime type from the object key extension. All rows are MinIO-backed.
  const mimeType = mimeFromKey(photo.object_key ?? "");

  // Detect if this photo came from a browser upload (flat uuid key under "uploads/").
  const isUploadOrigin = photo.object_key?.startsWith("uploads/") ?? false;

  // Videos: extract one preview frame, describe it, then mark ready (or pending_review
  // if it was uploaded via the browser).
  if (mimeType.startsWith("video/")) {
    let thumbnailPath: string | null = null;
    let description: string | null = null;
    let tags: string[] = ["videos"];
    try {
      // makeVideoThumbnail presigns the MinIO object and has ffmpeg range-read it,
      // so we never buffer the whole file. Non-fatal: missing frame shows no thumb.
      const frameKey = photo.object_key ?? "";
      const { path, frame } = await makeVideoThumbnail(frameKey);
      thumbnailPath = path;
      const analysis = await analyzePhoto(frame);
      if (analysis.description) description = analysis.description;
      if (analysis.tags.length) tags = analysis.tags;
    } catch {
      /* missing frame is non-fatal — the tile shows without a thumbnail */
    }

    const finalStatus = isUploadOrigin ? "pending_review" : "ready";

    // Auto-name upload-origin videos before the update so we can include it.
    let displayName: string | null = null;
    if (isUploadOrigin) {
      const prefix = categoryToPrefix["videos"] ?? "VID";
      const ext = photo.object_key?.split(".").pop() ?? "mp4";
      displayName = buildName({
        prefix,
        createdAt: photo.created_at ? new Date(photo.created_at) : new Date(),
        description: description ?? "",
        ext,
      });
    }

    await supabase
      .from("photos")
      .update({
        category: "videos",
        thumbnail_path: thumbnailPath,
        description,
        tags,
        status: finalStatus,
        ...(displayName ? { display_name: displayName } : {}),
      })
      .eq("id", photoId);
    return { id: photoId, status: finalStatus, category: "videos" };
  }

  // Photos: full pipeline. Download original from whatever backend holds it.
  const original = await getOriginal({
    id: photo.id,
    storage_backend: photo.storage_backend,
    object_key: photo.object_key,
    drive_file_id: photo.drive_file_id,
    display_name: photo.display_name,
    drive_name: photo.drive_name,
  });

  const thumb = await createThumbnail(original);

  // Thumbnail is keyed by photo id (not drive_file_id) so new MinIO photos get
  // a stable path whether or not they have a Drive id.
  const thumbnailPath = await storeThumbnailById(photoId, thumb);

  const { hash, duplicateGroupId } = await hashAndGroup(thumb);
  const { category, description, tags } = await analyzePhoto(thumb);

  // Upload-origin photos go to "pending_review" so the user can check + approve
  // them before they land on the main board. We also auto-derive a display name
  // from the category + vision description so she has something to edit.
  const finalStatus = isUploadOrigin ? "pending_review" : "ready";
  let displayName: string | null = null;
  if (isUploadOrigin && category) {
    const prefix = categoryToPrefix[category] ?? "UNSORTED";
    const ext = photo.object_key?.split(".").pop() ?? "jpg";
    displayName = buildName({
      prefix,
      createdAt: new Date(),
      description: description ?? "",
      ext,
    });
    // Persist via the shared helper (trims, caps length).
    await setDisplayName(photoId, displayName);
  }

  await supabase
    .from("photos")
    .update({
      thumbnail_path: thumbnailPath,
      perceptual_hash: hash,
      duplicate_group_id: duplicateGroupId,
      category,
      description,
      tags: tags.length ? tags : [category],
      status: finalStatus,
    })
    .eq("id", photoId);

  return { id: photoId, status: finalStatus, category };
}

// Infer a broad mime type from a MinIO object key extension.
// Only needs to distinguish "video/" from everything else.
function mimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "m4v", "avi", "mkv", "webm"].includes(ext)) {
    return "video/" + ext;
  }
  return "image/" + (ext || "jpeg");
}

// Store the thumbnail under the photo's UUID so new MinIO photos don't need a Drive id.
// (The existing storeThumbnail uses drive_file_id as the key; this uses photo id instead.)
async function storeThumbnailById(photoId: string, thumbnail: Buffer): Promise<string> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const path = `${photoId}.jpg`;
  const { error } = await supabase.storage
    .from("thumbnails")
    .upload(path, thumbnail, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Thumbnail upload failed: ${error.message}`);
  return path;
}
