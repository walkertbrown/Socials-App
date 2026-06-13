import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScheduledPost } from "@/lib/db/posts";

// Atomically claim ONE due reminder post: flip scheduled -> reminder_sent only if
// still scheduled. The status flip is the lock — if another cron tick already took
// it, this returns null, so her phone never gets pinged twice for one post.
export async function claimDueReminder(): Promise<ScheduledPost | null> {
  const sb = createAdminClient();
  const { data: due } = await sb
    .from("scheduled_posts")
    .select("id")
    .eq("status", "scheduled")
    .eq("delivery", "reminder")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!due) return null;

  const { data: claimed } = await sb
    .from("scheduled_posts")
    .update({ status: "reminder_sent", notified_at: new Date().toISOString() })
    .eq("id", due.id)
    .eq("status", "scheduled")
    .select("*")
    .maybeSingle();
  return (claimed as ScheduledPost) ?? null;
}

// She confirms she posted it manually. Allowed from reminder_sent (normal) or
// scheduled (she jumped the gun before the ping).
export async function markPosted(id: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({ status: "posted", published_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["reminder_sent", "scheduled"]);
}
