import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Deletes a staged public image. Best-effort — never throws (a leftover file is
// caught by the older-than-10-min sweeper in the cron).
export async function cleanupImage(path: string): Promise<void> {
  const sb = createAdminClient();
  try {
    await sb.storage.from("post-images").remove([path]);
  } catch {
    /* swept later */
  }
}

// Safety net: delete any staged images older than 10 minutes (orphans from a
// crash mid-publish), so no full-res photo lingers on a public URL.
export async function sweepStaleStagedImages(): Promise<void> {
  const sb = createAdminClient();
  const { data } = await sb.storage.from("post-images").list("", { limit: 1000 });
  if (!data) return;
  const cutoff = Date.now() - 10 * 60 * 1000;
  const stale = data
    .filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => f.name);
  if (stale.length) {
    try {
      await sb.storage.from("post-images").remove(stale);
    } catch {
      /* try again next sweep */
    }
  }
}
