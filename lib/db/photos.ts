import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Photo } from "@/lib/types";

// Insert placeholder rows for MinIO objects. Keyed on object_key (the unique MinIO
// path) so idempotency works without Drive ids. Returns the count of new rows only.
export async function insertMinioPlaceholders(
  objects: { key: string; name: string }[]
): Promise<number> {
  if (objects.length === 0) return 0;
  const supabase = createAdminClient();
  const rows = objects.map((o) => ({
    object_key: o.key,
    drive_name: o.name,
    storage_backend: "minio",
    status: "processing" as const,
  }));
  const { data, error } = await supabase
    .from("photos")
    .upsert(rows, { onConflict: "object_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

// Every photo still awaiting processing (includes leftovers from an
// interrupted run, so processing can resume).
export async function getProcessingIds(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("photos").select("id").eq("status", "processing");
  return (data ?? []).map((r) => r.id as string);
}

// Columns needed for the board/compose UI — omits heavy fields like `description`
// that are only needed for intent search (covered by getPhotosForMatching).
const BOARD_COLUMNS = [
  "id", "drive_file_id", "drive_name", "display_name", "object_key",
  "storage_backend", "thumbnail_path", "tags", "category", "status",
  "duplicate_group_id", "perceptual_hash", "picked", "picked_at", "posted",
  "text_safe", "drive_placed_at", "created_at",
].join(", ");

// Optional createdAfter filters by the photos_created_at_idx index (Phase 4 date filter).
// Limit caps the row count — the client paginates at 50, so 300 is plenty.
export async function getReadyPhotos(createdAfter?: Date, limit = 300): Promise<Photo[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("photos")
    .select(BOARD_COLUMNS)
    .eq("status", "ready")
    .neq("category", "videos")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (createdAfter) {
    query = query.gte("created_at", createdAfter.toISOString());
  }
  const { data } = await query;
  return (data ?? []) as unknown as Photo[];
}

// Batch-generate signed thumbnail URLs for an array of photos in ONE storage API
// call instead of one call per photo. Returns a map of thumbnail_path → signedUrl.
// TTL is 1 hour — long enough to survive a normal session.
export async function batchSignThumbnails(
  photos: Photo[]
): Promise<Map<string, string>> {
  const paths = photos
    .map((p) => p.thumbnail_path)
    .filter((p): p is string => !!p);

  if (paths.length === 0) return new Map();

  const admin = createAdminClient();
  const { data } = await admin.storage
    .from("thumbnails")
    .createSignedUrls(paths, 3600);

  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

// Videos ready to post (the photo reads deliberately exclude these). Used by the
// compose picker so she can pick a video for a reminder post.
export async function getReadyVideos(): Promise<Photo[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("photos")
    .select("*")
    .eq("status", "ready")
    .eq("category", "videos")
    .not("thumbnail_path", "is", null) // only ones with a usable preview frame
    .order("created_at", { ascending: false });
  return (data ?? []) as Photo[];
}

// Lightweight read for intent matching: just what we score on, for every
// ready (non-video) photo. ~80 rows — small enough to score in memory.
export interface MatchablePhoto {
  id: string;
  category: string | null;
  tags: string[] | null;
  description: string | null;
}
export async function getPhotosForMatching(): Promise<MatchablePhoto[]> {
  const supabase = createAdminClient();
  // Includes videos (they carry descriptions/tags too) so intent search can
  // surface a matching video alongside photos.
  const { data } = await supabase
    .from("photos")
    .select("id, category, tags, description")
    .eq("status", "ready");
  return (data ?? []) as MatchablePhoto[];
}

export async function getThumbnailPath(id: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("photos")
    .select("thumbnail_path")
    .eq("id", id)
    .maybeSingle();
  return data?.thumbnail_path ?? null;
}

// Overwrite a photo's tags (her manual edits on the board — e.g. adding a staff
// member's name so "a post about CJ" finds it). Sanitizes: trims, drops blanks,
// de-dupes case-insensitively, caps length and count.
export async function setTags(id: string, tags: string[]): Promise<string[]> {
  const supabase = createAdminClient();
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of tags) {
    const t = String(raw).trim().slice(0, 40);
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      clean.push(t);
    }
    if (clean.length >= 20) break;
  }
  await supabase.from("photos").update({ tags: clean }).eq("id", id);
  return clean;
}

export async function setPicked(id: string, picked: boolean): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("photos")
    .update({ picked, picked_at: picked ? new Date().toISOString() : null })
    .eq("id", id);
}

// Mark/unmark a photo as safe for text overlay. The AI only picks text_safe photos
// when generating graphics with a photo background (controlled safe-zone scrim).
export async function setTextSafe(id: string, textSafe: boolean): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("photos").update({ text_safe: textSafe }).eq("id", id);
}

// All ready (non-video) photos marked as safe for text overlay. Passed to the
// graphic design-spec AI so it only selects appropriate background photos.
export async function getTextSafePhotos(): Promise<MatchablePhoto[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("photos")
    .select("id, category, tags, description")
    .eq("status", "ready")
    .eq("text_safe", true)
    .neq("category", "videos");
  return (data ?? []) as MatchablePhoto[];
}

// Fetch only the fields needed by the storage adapter (used by the download route).
export async function getPhotoForStorage(
  id: string
): Promise<{
  id: string;
  storage_backend: string | null;
  object_key: string | null;
  drive_file_id: string | null;
  display_name: string | null;
  drive_name: string | null;
} | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("photos")
    .select("id, storage_backend, object_key, drive_file_id, display_name, drive_name")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

// Set a user-facing name for a photo (shown on the board; used in download filename).
// Trims whitespace and caps at 200 characters to stay reasonable in filenames.
export async function setDisplayName(id: string, name: string): Promise<string> {
  const cleaned = name.trim().slice(0, 200);
  const supabase = createAdminClient();
  await supabase.from("photos").update({ display_name: cleaned || null }).eq("id", id);
  return cleaned;
}

// ── Infographic-board helper ──────────────────────────────────────────────────

// Insert a fully-processed photos row for a generated infographic so it appears
// on the board immediately. drive_placed_at stays NULL so the external mirror job
// picks it up and copies the MinIO original to Drive/06_Infographic.
export async function insertReadyPhoto(row: {
  object_key: string;
  thumbnail_path: string;
  post_ready_path: string;
  display_name: string;
  drive_name: string;
  category: string;
  tags: string[];
}): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("photos")
    .insert({
      object_key: row.object_key,
      thumbnail_path: row.thumbnail_path,
      post_ready_path: row.post_ready_path,
      display_name: row.display_name,
      drive_name: row.drive_name,
      category: row.category,
      tags: row.tags,
      storage_backend: "minio",
      status: "ready",
      drive_placed_at: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

// ── Upload-flow helpers ───────────────────────────────────────────────────────

// Insert a placeholder row for a direct-to-MinIO upload in progress.
// Returns the new row's id so the client can track it and POST /api/process later.
// object_key is the flat uuid-based key (e.g. "uploads/abc.jpg").
// filename is the original browser filename stored as drive_name for display.
export async function insertUploadPlaceholder(
  objectKey: string,
  filename: string
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("photos")
    .insert({
      object_key: objectKey,
      drive_name: filename,
      storage_backend: "minio",
      status: "processing",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

// Hard-delete a placeholder row. Used by the abort route to clean up a row whose
// upload failed so it never becomes an orphan.
export async function deletePhoto(id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("photos").delete().eq("id", id);
}

// ── Review-gate helpers ───────────────────────────────────────────────────────

// All photos waiting for the user to approve (or edit + approve) before they
// appear on the main board. These are upload-origin photos that have been
// processed (vision-tagged + auto-named) but not yet approved.
export async function getPendingReview(): Promise<Photo[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("photos")
    .select("*")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });
  return (data ?? []) as Photo[];
}

// Re-derive a suggested display_name when the user changes category on the review
// screen. Computes the prefix from the new category and rebuilds the name using
// whatever description the vision tag already produced. Caller (the review UI) can
// still let the user override the computed name afterwards.
export async function setCategory(id: string, category: string): Promise<string | null> {
  const { isCategoryKey } = await import("@/lib/categories");
  if (!isCategoryKey(category)) throw new Error("Unknown category: " + category);

  const supabase = createAdminClient();

  // Read the current photo to get description + created_at for re-deriving the name.
  const { data: photo } = await supabase
    .from("photos")
    .select("description, created_at, object_key")
    .eq("id", id)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found");

  // Re-derive the suggested name so the review screen can show it immediately.
  const { buildName, categoryToPrefix } = await import("@/lib/naming");
  const prefix = categoryToPrefix[category as keyof typeof categoryToPrefix] ?? "UNSORTED";
  const ext = photo.object_key?.split(".").pop() ?? "jpg";
  const suggestedName = buildName({
    prefix,
    createdAt: new Date(photo.created_at),
    description: photo.description ?? "",
    ext,
  });

  await supabase
    .from("photos")
    .update({ category, tags: [category], display_name: suggestedName })
    .eq("id", id);

  return suggestedName;
}

// Move a pending_review photo to ready (appears on the main board).
// drive_placed_at stays NULL so the box job picks it up for Drive mirroring.
export async function approvePhoto(id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("photos")
    .update({ status: "ready" })
    .eq("id", id)
    .eq("status", "pending_review");
}
