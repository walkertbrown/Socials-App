import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ScheduledPost {
  id: string;
  photo_id: string | null;
  caption: string;
  platforms: string[];
  scheduled_at: string;
  // 'auto' = app publishes it (photos). 'reminder' = app pings her phone (video).
  delivery: "auto" | "reminder";
  status:
    | "scheduled"
    | "publishing"
    | "published"
    | "failed"
    | "canceled"
    | "reminder_sent"
    | "posted";
  attempts: number;
  error: string | null;
  fb_post_id: string | null;
  ig_post_id: string | null;
  created_at: string;
  published_at: string | null;
  notified_at: string | null;
}

export async function createPost(input: {
  photo_id: string;
  caption: string;
  platforms: string[];
  scheduled_at: string;
  delivery?: "auto" | "reminder";
}): Promise<ScheduledPost> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("scheduled_posts")
    .insert({ ...input, delivery: input.delivery ?? "auto" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ScheduledPost;
}

export async function listPosts(): Promise<ScheduledPost[]> {
  const sb = createAdminClient();
  const { data } = await sb.from("scheduled_posts").select("*").order("scheduled_at", { ascending: true });
  return (data ?? []) as ScheduledPost[];
}

export async function getPost(id: string): Promise<ScheduledPost | null> {
  const sb = createAdminClient();
  const { data } = await sb.from("scheduled_posts").select("*").eq("id", id).maybeSingle();
  return (data as ScheduledPost) ?? null;
}

// Atomically claim ONE due post: flip scheduled -> publishing only if still
// scheduled. If another cron tick already grabbed it, this returns null. This is
// the status-lock that prevents the same post from being published twice.
export async function claimDuePost(): Promise<ScheduledPost | null> {
  const sb = createAdminClient();
  const { data: due } = await sb
    .from("scheduled_posts")
    .select("id")
    .eq("status", "scheduled")
    .eq("delivery", "auto") // reminders are handled separately, never auto-published
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
    })
    .eq("id", id);
}

// On failure: give up after 2 attempts (status 'failed'), else return to
// 'scheduled' for one more try. Never loops forever.
export async function recordFailure(id: string, attempts: number, error: string): Promise<void> {
  const sb = createAdminClient();
  const next = attempts + 1;
  await sb
    .from("scheduled_posts")
    .update({ status: next >= 2 ? "failed" : "scheduled", attempts: next, error })
    .eq("id", id);
}

export async function cancelPost(id: string): Promise<void> {
  const sb = createAdminClient();
  await sb.from("scheduled_posts").update({ status: "canceled" }).eq("id", id).eq("status", "scheduled");
}

export async function retryPost(id: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({ status: "scheduled", attempts: 0, error: null })
    .eq("id", id)
    .eq("status", "failed");
}
