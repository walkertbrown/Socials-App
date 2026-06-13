import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Photo } from "@/lib/types";

// Insert placeholder rows for files we haven't seen before. The unique
// constraint on drive_file_id makes this idempotent: re-syncing the same
// folder inserts nothing for already-known photos. Returns the new count.
export async function insertPlaceholders(
  files: { id: string; name: string }[]
): Promise<number> {
  if (files.length === 0) return 0;
  const supabase = createAdminClient();
  const rows = files.map((f) => ({
    drive_file_id: f.id,
    drive_name: f.name,
    status: "processing" as const,
  }));
  const { data, error } = await supabase
    .from("photos")
    .upsert(rows, { onConflict: "drive_file_id", ignoreDuplicates: true })
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
