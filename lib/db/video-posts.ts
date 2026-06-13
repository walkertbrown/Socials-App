import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScheduledPost } from "@/lib/db/posts";

// ── Claim helpers for the video Reel state machine ────────────────────────────
//
// Two distinct claim operations:
//   1. claimDueVideoPost  – picks a 'scheduled' video row and moves it to
//      'publishing', starting the staging + container creation tick.
//   2. claimVideoInFlight – picks a 'publishing' video row that has a
//      publish_substate indicating it's mid-way through the pipeline, so the
//      next cron tick can advance it (poll IG / finish FB).
//
// Both use an atomic compare-and-swap so only one cron tick ever holds a row.

// Claim a video post that's ready to start publishing (still 'scheduled').
export async function claimDueVideoPost(): Promise<ScheduledPost | null> {
  const sb = createAdminClient();
  const { data: due } = await sb
    .from("scheduled_posts")
    .select("id")
    .eq("status", "scheduled")
    .eq("delivery", "auto")
    .eq("media_type", "video")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!due) return null;

  const { data: claimed } = await sb
    .from("scheduled_posts")
    .update({ status: "publishing", publish_substate: "staging" })
    .eq("id", due.id)
    .eq("status", "scheduled")
    .select("*")
    .maybeSingle();
  return (claimed as ScheduledPost) ?? null;
}

// Claim a video row that's mid-pipeline (already 'publishing' with a substate).
// Used by the cron's "advance" tick — poll IG container / finish FB upload.
// The substate must NOT be 'staging' (that's still in progress on another tick).
export async function claimVideoInFlight(): Promise<ScheduledPost | null> {
  const sb = createAdminClient();
  // Look for publishing rows past the initial staging step.
  const { data: due } = await sb
    .from("scheduled_posts")
    .select("id")
    .eq("status", "publishing")
    .eq("media_type", "video")
    .not("publish_substate", "eq", "staging")
    .not("publish_substate", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!due) return null;

  // Re-select the full row (no status change needed — it's already 'publishing').
  const { data: row } = await sb
    .from("scheduled_posts")
    .select("*")
    .eq("id", due.id)
    .maybeSingle();
  return (row as ScheduledPost) ?? null;
}

// Persist the IG container id after `POST {ig-user}/media` returns.
export async function setIgContainerId(id: string, containerId: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({ ig_container_id: containerId, publish_substate: "ig_container_created" })
    .eq("id", id);
}

// Persist the FB video id after the `upload_phase=start` call returns.
export async function setFbVideoId(id: string, videoId: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({ fb_video_id: videoId, publish_substate: "fb_upload_started" })
    .eq("id", id);
}

// Mark that the FB upload POST was accepted (Meta is fetching the file_url).
export async function setFbUploadDone(id: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({ publish_substate: "fb_upload_done" })
    .eq("id", id);
}

// Persist the staged video path so the cron can clean it up after publish.
export async function setStagedPath(id: string, path: string): Promise<void> {
  const sb = createAdminClient();
  await sb.from("scheduled_posts").update({ staged_path: path }).eq("id", id);
}
