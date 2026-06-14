import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupVideo } from "@/lib/publish/cleanup-video";

// Stuck-post recovery: a video killed mid-staging (server crash, timeout) can
// sit in 'publishing' forever and is invisible to the claim logic that only
// looks for 'scheduled' rows. After ~30 minutes we declare it failed so the
// operator can retry, and we clean up any staged file it left behind.
//
// Photos rarely get stuck (publishing is synchronous), but we include them too
// as a safety net.
const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function recoverStuck(): Promise<void> {
  const sb = createAdminClient();
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

  const { data: stuck } = await sb
    .from("scheduled_posts")
    .select("id, staged_path, attempts")
    .eq("status", "publishing")
    .lt("created_at", cutoff); // using created_at as a proxy; stuck rows have old timestamps

  if (!stuck?.length) return;

  for (const row of stuck) {
    // Clean up any staged video file first (best-effort).
    if (row.staged_path) {
      await cleanupVideo(row.staged_path as string);
    }

    // Mark failed — attempts keeps its current count so retry logic applies.
    const next = (row.attempts ?? 0) + 1;
    await sb
      .from("scheduled_posts")
      .update({
        status: next >= 2 ? "failed" : "scheduled",
        attempts: next,
        error: "Publish timed out (stuck in publishing for >30 min). Retry to try again.",
        publish_substate: null,
        staged_path: null,
      })
      .eq("id", row.id)
      .eq("status", "publishing"); // CAS: only if still stuck
  }
}
