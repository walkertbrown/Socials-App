import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ScheduledPost {
  id: string;
  photo_id: string | null;
  caption: string;
  // Per-platform shape (post 0006): one row per platform.
  platform: string;
  post_group_id: string | null;
  // 'graphic' is a third media type for in-app generated graphics (photo_id is a
  // graphics table id; the PNG is already in the 'graphics' bucket).
  media_type: "image" | "video" | "graphic" | "carousel";
  scheduled_at: string;
  // 'auto' = app publishes it (photos + Reels + graphics). 'reminder' = app pings her phone.
  delivery: "auto" | "reminder";
  status:
    | "scheduled"
    | "publishing"
    | "published"
    | "failed"
    | "canceled"
    | "reminder_sent"
    | "posted";
  // Reel progress lives here so the top-level status stays clean.
  publish_substate: string | null;
  attempts: number;
  error: string | null;
  fb_post_id: string | null;
  ig_post_id: string | null;
  // Video Reel staging state.
  ig_container_id: string | null;
  fb_video_id: string | null;
  staged_path: string | null;
  created_at: string;
  published_at: string | null;
  notified_at: string | null;
  // Learning loop (0007): capture what the AI drafted vs what she finally posted.
  ai_draft: string | null;
  is_exemplar: boolean;
  // Insights staleness tracking.
  insights_fetched_at: string | null;
  insights_final: boolean;
}

// Create a single scheduled post for one platform.
export async function createPost(input: {
  photo_id: string;
  caption: string;
  platform: string;
  post_group_id?: string;
  media_type?: "image" | "video" | "graphic";
  scheduled_at: string;
  delivery?: "auto" | "reminder";
  // The raw AI draft before she edited it — diff source for the learning loop.
  ai_draft?: string | null;
}): Promise<ScheduledPost> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("scheduled_posts")
    .insert({
      ...input,
      media_type: input.media_type ?? "image",
      delivery: input.delivery ?? "auto",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ScheduledPost;
}

// Create a group of per-platform rows under one shared post_group_id.
// Returns all created rows.
export async function createPostGroup(
  rows: Array<{
    photo_id: string;
    photo_ids?: string[];
    caption: string;
    platform: string;
    media_type: "image" | "video" | "graphic" | "carousel";
    scheduled_at: string;
    delivery: "auto" | "reminder";
    ai_draft?: string | null;
  }>,
  postGroupId: string
): Promise<ScheduledPost[]> {
  const sb = createAdminClient();
  const inserts = rows.map((r) => ({ ...r, post_group_id: postGroupId }));
  const { data, error } = await sb.from("scheduled_posts").insert(inserts).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledPost[];
}

export async function listPosts(): Promise<ScheduledPost[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("scheduled_posts")
    .select("*")
    .order("scheduled_at", { ascending: true });
  return (data ?? []) as ScheduledPost[];
}

export async function getPost(id: string): Promise<ScheduledPost | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("scheduled_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ScheduledPost) ?? null;
}

// Atomically claim ONE due photo/graphic-auto post: flip scheduled -> publishing
// only if still scheduled. If another cron tick already grabbed it, returns null.
// Picks image AND graphic auto rows — video rows go through claimDueVideoPost.
export async function claimDuePost(): Promise<ScheduledPost | null> {
  const sb = createAdminClient();
  const { data: due } = await sb
    .from("scheduled_posts")
    .select("id")
    .eq("status", "scheduled")
    .eq("delivery", "auto")
    .in("media_type", ["image", "graphic"])
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!due) return null;

  const { data: claimed } = await sb
    .from("scheduled_posts")
    .update({ status: "publishing" })
    .eq("id", due.id)
    .eq("status", "scheduled")
    .select("*")
    .maybeSingle();
  return (claimed as ScheduledPost) ?? null;
}

export async function markPublished(
  id: string,
  ids: { fb_post_id?: string | null; ig_post_id?: string | null }
): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      fb_post_id: ids.fb_post_id ?? null,
      ig_post_id: ids.ig_post_id ?? null,
      error: null,
      publish_substate: null,
      staged_path: null,
    })
    .eq("id", id);
}

// On failure: give up after 2 attempts (status 'failed'), else return to
// 'scheduled' for one more try. Never loops forever.
export async function recordFailure(
  id: string,
  attempts: number,
  error: string
): Promise<void> {
  const sb = createAdminClient();
  const next = attempts + 1;
  await sb
    .from("scheduled_posts")
    .update({
      status: next >= 2 ? "failed" : "scheduled",
      attempts: next,
      error,
      publish_substate: null,
    })
    .eq("id", id);
}

export async function cancelPost(id: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("status", "scheduled");
}

export async function retryPost(id: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({ status: "scheduled", attempts: 0, error: null })
    .eq("id", id)
    .eq("status", "failed");
}

// Toggle exemplar status — pinned posts are always included in the voice corpus.
export async function setExemplar(id: string, value: boolean): Promise<void> {
  const sb = createAdminClient();
  await sb.from("scheduled_posts").update({ is_exemplar: value }).eq("id", id);
}
