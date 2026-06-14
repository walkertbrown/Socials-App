import "server-only";
import { graph } from "@/lib/meta/client";

// IG account-level metrics fetched over a date window (since/until as Unix timestamps).
// follows_and_unfollows with breakdown=follow_type gives the net growth breakdown.
// profile_links_taps = link-in-bio taps.
// online_followers is intentionally excluded — it returns empty per ground-truth probe.
const IG_ACCOUNT_METRICS = [
  "reach",
  "views",
  "follows_and_unfollows",
  "profile_links_taps",
].join(",");

// FB page-level metrics over a date window.
// followers_count is a lifetime metric, fetched separately as a point-in-time snapshot.
const FB_PAGE_METRICS = [
  "page_impressions_unique",
  "page_post_engagements",
].join(",");

function safeInt(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

// Extract the 'total_value' sum from a Meta insights metric object.
// Meta returns: { name, period, values:[{value, end_time},...], title, ... }
// For aggregated window metrics the caller uses 'period=day' and we sum, or
// they may return a single total_value object depending on metric type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumMetricValues(metric: any): number | null {
  if (!metric) return null;
  // Some metrics return total_value at top level (metric_type=total_value).
  if (metric.total_value?.value != null) return safeInt(metric.total_value.value);
  // Standard day-period: sum all day values.
  if (Array.isArray(metric.values)) {
    let total = 0;
    for (const v of metric.values) {
      const n = safeInt(v.value);
      if (n != null) total += n;
    }
    return total;
  }
  return null;
}

export interface IgAccountMetrics {
  reach: number | null;
  views: number | null;
  // Net: follows minus unfollows in the window.
  net_followers: number | null;
  link_taps: number | null;
}

// Fetch IG account-level metrics for a Mon–Sun window.
// since/until are Unix epoch seconds.
// Never throws — returns nulls on any error.
export async function fetchIgAccountInsights(
  igUserId: string,
  token: string,
  since: number,
  until: number
): Promise<IgAccountMetrics> {
  try {
    const data = await graph(`${igUserId}/insights`, {
      token,
      params: {
        metric: IG_ACCOUNT_METRICS,
        period: "day",
        since: String(since),
        until: String(until),
        // follows_and_unfollows needs breakdown=follow_type to split follows/unfollows
        breakdown: "follow_type",
      },
    });

    // Meta returns data as an array of metric objects keyed by 'name'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byName: Record<string, any> = {};
    if (Array.isArray(data?.data)) {
      for (const m of data.data) byName[m.name] = m;
    }

    // Net follower growth: follows minus unfollows.
    // follows_and_unfollows breakdown gives us separate follow/unfollow counts.
    let netFollowers: number | null = null;
    const fauMetric = byName["follows_and_unfollows"];
    if (fauMetric?.total_value?.breakdowns?.[0]?.results) {
      let follows = 0;
      let unfollows = 0;
      for (const r of fauMetric.total_value.breakdowns[0].results) {
        // dimension_values[0] will be 'FOLLOW' or 'UNFOLLOW'
        const type = r.dimension_values?.[0]?.toUpperCase();
        const val = safeInt(r.value) ?? 0;
        if (type === "FOLLOW") follows += val;
        else if (type === "UNFOLLOW") unfollows += val;
      }
      netFollowers = follows - unfollows;
    } else if (fauMetric) {
      // Fallback: sum all values if breakdown not available
      netFollowers = sumMetricValues(fauMetric);
    }

    return {
      reach: sumMetricValues(byName["reach"]),
      views: sumMetricValues(byName["views"]),
      net_followers: netFollowers,
      link_taps: sumMetricValues(byName["profile_links_taps"]),
    };
  } catch {
    return { reach: null, views: null, net_followers: null, link_taps: null };
  }
}

export interface FbPageMetrics {
  reach: number | null;
  engagement: number | null;
  // followers_count is a lifetime metric snapshotted at cron time.
  followers_count: number | null;
}

// Fetch FB page-level metrics for a Mon–Sun window.
// since/until are Unix epoch seconds.
// Never throws — returns nulls on any error.
export async function fetchFbPageInsights(
  pageId: string,
  token: string,
  since: number,
  until: number
): Promise<FbPageMetrics> {
  try {
    const data = await graph(`${pageId}/insights`, {
      token,
      params: {
        metric: FB_PAGE_METRICS,
        period: "day",
        since: String(since),
        until: String(until),
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byName: Record<string, any> = {};
    if (Array.isArray(data?.data)) {
      for (const m of data.data) byName[m.name] = m;
    }

    // followers_count is a page-level field, not in /insights — fetch separately.
    let followersCount: number | null = null;
    try {
      const pageData = await graph(pageId, {
        token,
        params: { fields: "followers_count" },
      });
      followersCount = safeInt(pageData.followers_count);
    } catch {
      // Non-fatal — FB demographics/follower data may be restricted
    }

    return {
      reach: sumMetricValues(byName["page_impressions_unique"]),
      engagement: sumMetricValues(byName["page_post_engagements"]),
      followers_count: followersCount,
    };
  } catch {
    return { reach: null, engagement: null, followers_count: null };
  }
}
