import "server-only";
import { graph } from "@/lib/meta/client";

// IG media insight field names we request.
const IG_FIELDS = "reach,likes_count,comments_count,saved,shares_count";
// FB post fields that give reach + engagement.
const FB_FIELDS =
  "post_impressions_unique,reactions.summary(true),comments.summary(true),shares";

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
    };
  } catch {
    return { reach: null, likes: null, comments: null, saves: null, shares: null };
  }
}

export interface FbMetrics {
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
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
      // reactions.summary.total_count is the standard likes-equivalent.
      likes: safeInt(data.reactions?.summary?.total_count),
      comments: safeInt(data.comments?.summary?.total_count),
      saves: null, // FB doesn't expose saves
      shares: safeInt(data.shares?.count),
    };
  } catch {
    return { reach: null, likes: null, comments: null, saves: null, shares: null };
  }
}
