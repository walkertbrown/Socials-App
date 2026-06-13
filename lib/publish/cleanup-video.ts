import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "post-videos";
// Reels processing takes longer than photo staging (Meta ingests asynchronously),
// so we use a 60-minute cutoff instead of the 10-minute one for images.
const STALE_VIDEO_CUTOFF_MS = 60 * 60 * 1000;

// Deletes a staged public video. Best-effort — never throws.
export async function cleanupVideo(path: string): Promise<void> {
  const sb = createAdminClient();
  try {
    await sb.storage.from(BUCKET).remove([path]);
  } catch {
    /* swept by sweepStaleStagedVideos on the next cron tick */
  }
}

// Safety net: delete staged videos older than 60 minutes (orphans from a crash
// mid-Reel publish, which involves a multi-tick pipeline).
export async function sweepStaleStagedVideos(): Promise<void> {
  const sb = createAdminClient();
  const { data } = await sb.storage.from(BUCKET).list("", { limit: 1000 });
  if (!data) return;
  const cutoff = Date.now() - STALE_VIDEO_CUTOFF_MS;
  const stale = data
    .filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => f.name);
  if (stale.length) {
    try {
      await sb.storage.from(BUCKET).remove(stale);
    } catch {
      /* try again next sweep */
    }
  }
}
