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
    .order("created_at", { ascending: false });
  return (data ?? []) as Photo[];
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

export async function setPicked(id: string, picked: boolean): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("photos")
    .update({ picked, picked_at: picked ? new Date().toISOString() : null })
    .eq("id", id);
}
