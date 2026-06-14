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
  views: number | null;  // video views — 'views' is the live Meta field name
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

// Read per-post insights for a date range — used by the weekly report compute.
// Returns all posts (including those without insights) so the report knows the
// full native-sweep count.
export interface PostInsightsRow {
  post_id: string;
  platform: string | null;
  caption: string | null;
  media_type: string | null;
  format: string | null;      // derived from media_product_type/media_type
  source: string | null;      // null = composed in-app; 'native' = swept
  published_at: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  views: number | null;
}

export async function getPostInsightsForWeek(
  weekStart: Date,
  weekEnd: Date
): Promise<PostInsightsRow[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("scheduled_posts")
    .select(
      "id, platform, caption, media_type, source, published_at, post_insights(reach, likes, comments, saves, shares, views)"
    )
    .eq("status", "published")
    .gte("published_at", weekStart.toISOString())
    .lt("published_at", weekEnd.toISOString())
    .order("published_at", { ascending: true });

  if (error || !data) return [];

  // Flatten the joined post_insights into each row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => {
    const ins = Array.isArray(row.post_insights)
      ? row.post_insights[0]
      : row.post_insights;
    return {
      post_id: row.id,
      platform: row.platform,
      caption: row.caption,
      media_type: row.media_type,
      format: null,       // enriched later from native-sweep source field
      source: row.source,
      published_at: row.published_at,
      reach: ins?.reach ?? null,
      likes: ins?.likes ?? null,
      comments: ins?.comments ?? null,
      saves: ins?.saves ?? null,
      shares: ins?.shares ?? null,
      views: ins?.views ?? null,
    };
  });
}
