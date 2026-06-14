import "server-only";
import { graph } from "@/lib/meta/client";

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
// Uses TWO Graph API calls:
//   (a) /{mediaId}/insights — for reach, saves, shares, views (media insights endpoint)
//   (b) /{mediaId}?fields=like_count,comments_count — for likes and comments
// The two calls are independent — if one fails we use whatever the other returned.
// Never throws — returns nulls on total error so the cron keeps moving.
export async function fetchInstagramInsights(
  mediaId: string,
  token: string
): Promise<IgMetrics> {
  const nulls: IgMetrics = { reach: null, likes: null, comments: null, saves: null, shares: null, views: null };
  let result: IgMetrics = { ...nulls };

  // Call (a): media insights endpoint — reach, saved, shares, views.
  // Response shape: { data: [{ name: string, values: [{ value: number }] }] }
  try {
    const insightsData = await graph(`${mediaId}/insights`, {
      token,
      params: { metric: "reach,saved,shares,views,total_interactions" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byName: Record<string, any> = {};
    if (Array.isArray(insightsData?.data)) {
      for (const m of insightsData.data) byName[m.name] = m;
    }
    // Read the first value entry for each metric.
    const readMetric = (name: string) => safeInt(byName[name]?.values?.[0]?.value);
    result.reach = readMetric("reach");
    result.saves = readMetric("saved");
    result.shares = readMetric("shares");
    result.views = readMetric("views");
    // total_interactions has no IgMetrics field — requested but not stored.
  } catch {
    // Call (a) failed — leave reach/saves/shares/views as null, still attempt (b).
  }

  // Call (b): media object fields — like_count (singular), comments_count.
  // Note: the field is 'like_count' (not 'likes_count') per the live API.
  try {
    const fieldData = await graph(`${mediaId}`, {
      token,
      params: { fields: "like_count,comments_count" },
    });
    result.likes = safeInt(fieldData.like_count);
    result.comments = safeInt(fieldData.comments_count);
  } catch {
    // Call (b) failed — likes and comments remain null.
  }

  return result;
}

export interface FbMetrics {
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  views: number | null;
}

// FB per-post insights are blocked by the current token scope.
// Reading reactions/comments returns "(#200) Missing Permissions" and
// /insights returns empty data — so we don't issue the call at all.
// Known limitation; expanding FB permissions is out of scope here.
// Never throws — returns nulls so the cron keeps moving.
export async function fetchFacebookInsights(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  token: string
): Promise<FbMetrics> {
  return { reach: null, likes: null, comments: null, saves: null, shares: null, views: null };
}
