import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PostInsights {
  post_id: string;
  platform: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  fetched_at: string;
}

// Write (or overwrite) metrics for one post.
export async function upsertInsights(metrics: PostInsights): Promise<void> {
  const sb = createAdminClient();
  await sb.from("post_insights").upsert(metrics, { onConflict: "post_id" });
}

// Stamp the parent scheduled_posts row with the fetch time and optionally
// mark it final (>30 days old → never fetch again).
export async function markInsightsFetched(
  postId: string,
  opts: { final?: boolean } = {}
): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("scheduled_posts")
    .update({
      insights_fetched_at: new Date().toISOString(),
      ...(opts.final ? { insights_final: true } : {}),
    })
    .eq("id", postId);
}
