import "server-only";
import { graph } from "@/lib/meta/client";

// IG media fields — 'views' is the confirmed live field for video plays/reach
// (not 'impressions' or 'plays' which Meta has deprecated or returns empty).
// 'saved' and 'shares_count' are the live per-media-object field names.
const IG_FIELDS = "reach,likes_count,comments_count,saved,shares_count,views";

// FB post fields — post_impressions_unique is the per-post unique reach.
// post_clicks covers link taps at the post level.
const FB_FIELDS =
  "post_impressions_unique,reactions.summary(true),comments.summary(true),shares,post_clicks";

// Tolerate missing / deprecated metric keys — Meta silently drops fields they've
// removed, and we don't want that to blow up the cron.
function safeInt(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export interface IgMetrics {
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  views: number | null;
}

// Fetch engagement metrics for an Instagram media object.
// Never throws — returns nulls on any error so the cron keeps moving.
export async function fetchInstagramInsights(
  mediaId: string,
  token: string
): Promise<IgMetrics> {
  try {
    const data = await graph(`${mediaId}`, {
      token,
      params: { fields: IG_FIELDS },
    });
    return {
      reach: safeInt(data.reach),
      likes: safeInt(data.likes_count),
      comments: safeInt(data.comments_count),
      saves: safeInt(data.saved),
      shares: safeInt(data.shares_count),
      views: safeInt(data.views),
    };
  } catch {
    return { reach: null, likes: null, comments: null, saves: null, shares: null, views: null };
  }
}

export interface FbMetrics {
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  views: number | null;
}

// Fetch engagement metrics for a Facebook post.
// Never throws — returns nulls on any error.
export async function fetchFacebookInsights(
  postId: string,
  token: string
): Promise<FbMetrics> {
  try {
    const data = await graph(`${postId}`, {
      token,
      params: { fields: FB_FIELDS },
    });
    return {
      reach: safeInt(data.post_impressions_unique),
      // reactions.summary.total_count is the standard likes-equivalent for FB.
      likes: safeInt(data.reactions?.summary?.total_count),
      comments: safeInt(data.comments?.summary?.total_count),
      saves: null, // FB doesn't expose saves
      shares: safeInt(data.shares?.count),
      // FB Reels/video: use 'views' when available, fall back to post_clicks
      views: safeInt(data.views),
    };
  } catch {
    return { reach: null, likes: null, comments: null, saves: null, shares: null, views: null };
  }
}
