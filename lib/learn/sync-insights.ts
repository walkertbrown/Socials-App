import "server-only";
import { requireCredentials } from "@/lib/meta/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchInstagramInsights, fetchFacebookInsights } from "@/lib/meta/insights";
import { upsertInsights, markInsightsFetched } from "@/lib/db/post-insights";
import type { ScheduledPost } from "@/lib/db/posts";

// Thirty days in milliseconds — after this a post's metrics are considered final.
const FINAL_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// Sync engagement metrics from Meta into post_insights for recently-published posts.
//
// Cost guards — all three must hold:
//   1. requireCredentials() must succeed — if Meta isn't connected this no-ops cleanly.
//   2. Query filters: status='published', insights_final=false, and staleness window
//      (insights_fetched_at is null OR > 24h ago) are ALL IN THE QUERY — we never
//      pull a row and then decide to skip it.
//   3. Hard .limit(5) on the query — never unbounded.
//
// Each failure per-post is caught so one bad API call can't abort the rest.
//
// Returns the number of posts processed. The weekly cron uses this to run up to
// 4 bounded passes (up to ~20 posts total) and break early when nothing is left.
// publish-due ignores the return value — this is fully backward-compatible.
export async function syncInsights(): Promise<number> {
  // Gate 1: Meta credentials must be present.  If not connected, no-op.
  let creds: Awaited<ReturnType<typeof requireCredentials>>;
  try {
    creds = await requireCredentials();
  } catch {
    return 0; // Meta not connected yet — silently skip
  }

  const sb = createAdminClient();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Gate 2+3: staleness AND done-state filters are in the query.
  const { data: posts, error } = await sb
    .from("scheduled_posts")
    .select("id, platform, ig_post_id, fb_post_id, published_at, insights_fetched_at")
    .eq("status", "published")
    .eq("insights_final", false)
    .or(`insights_fetched_at.is.null,insights_fetched_at.lt.${cutoff24h}`)
    .order("published_at", { ascending: false })
    .limit(5); // hard cap — non-negotiable

  if (error || !posts?.length) return 0;

  // requireCredentials() has already thrown if page_token is null.
  const token = creds.page_token as string;

  for (const post of posts as ScheduledPost[]) {
    try {
      const isOld =
        post.published_at != null &&
        Date.now() - new Date(post.published_at).getTime() > FINAL_AFTER_MS;

      // 'posted' (reminder) rows have no media id — skip metrics fetch.
      // (We only touch status='published' rows, but guard anyway.)
      if (!post.ig_post_id && !post.fb_post_id) {
        await markInsightsFetched(post.id, { final: isOld });
        continue;
      }

      let metrics = {
        reach: null as number | null,
        likes: null as number | null,
        comments: null as number | null,
        saves: null as number | null,
        shares: null as number | null,
        views: null as number | null,
      };

      if (post.ig_post_id) {
        // ig_post_id is non-null inside this branch — the guard above confirms it.
        const ig = await fetchInstagramInsights(post.ig_post_id as string, token);
        metrics = { ...metrics, ...ig };
      } else if (post.fb_post_id) {
        const fb = await fetchFacebookInsights(post.fb_post_id as string, token);
        metrics = { ...metrics, ...fb };
      }

      await upsertInsights({
        post_id: post.id,
        platform: post.platform,
        ...metrics,
        fetched_at: new Date().toISOString(),
      });

      await markInsightsFetched(post.id, { final: isOld });
    } catch {
      // Per-post failure must not abort the loop — just continue.
    }
  }

  // After updating metrics, refresh perf_score in hashtag_vocab.
  // A tag earns a higher score when posts that use it have higher reach.
  await refreshHashtagPerfScores(sb);

  // Return the number of posts processed so the weekly cron can decide
  // whether to run another pass (early break when n < 5 means nothing left).
  return posts.length;
}

// Update perf_score for each tag in hashtag_vocab using average reach of posts
// that contained the tag.  Bounded: only looks at the 100 most recent published rows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshHashtagPerfScores(sb: any): Promise<void> {
  try {
    const { data: posts } = await sb
      .from("scheduled_posts")
      .select("caption, post_insights(reach)")
      .eq("status", "published")
      .not("post_insights", "is", null)
      .order("published_at", { ascending: false })
      .limit(100);

    if (!posts?.length) return;

    const tagReach: Map<string, number[]> = new Map();

    for (const post of posts) {
      const reach = post.post_insights?.reach;
      if (reach == null) continue;
      const tags = (post.caption ?? "").match(/#[\w]+/g) ?? [];
      for (const tag of tags) {
        const key = tag.toLowerCase();
        if (!tagReach.has(key)) tagReach.set(key, []);
        tagReach.get(key)!.push(reach);
      }
    }

    for (const [tag, reaches] of tagReach) {
      const avg = reaches.reduce((a, b) => a + b, 0) / reaches.length;
      // Update all category rows and the global null row for this tag.
      await sb
        .from("hashtag_vocab")
        .update({ perf_score: avg })
        .eq("tag", tag);
    }
  } catch {
    // perf_score refresh is best-effort — never break the cron
  }
}
