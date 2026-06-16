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

export async function getReadyPhotos(): Promise<Photo[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("photos")
    .select("*")
    .eq("status", "ready")
    .neq("category", "videos")
    .order("created_at", { ascending: false });
  return (data ?? []) as Photo[];
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
