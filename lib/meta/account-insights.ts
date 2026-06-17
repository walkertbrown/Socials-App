import "server-only";
import { graph } from "@/lib/meta/client";

// IG account-level metrics fetched over a date window (since/until as Unix timestamps).
// metric_type=total_value collapses daily buckets into one total per metric.
// profile_links_taps = link-in-bio taps.
// follows_and_unfollows was removed — that metric requires breakdown=follow_type which
// is permission-blocked; net_followers is now derived as a WoW delta in the cron.
// online_followers is intentionally excluded — returns empty per ground-truth probe.
const IG_ACCOUNT_METRICS = [
  "reach",
  "views",
  "profile_links_taps",
].join(",");

// FB page-level metrics over a date window.
// ⚠️ 2026-06: Meta deprecated the page "impressions" family. As of the 2026-06-15
// enforcement, `page_impressions_unique` returns "(#100) must be a valid insights metric"
// — which threw the whole /insights call (and, per the old code structure, nulled
// followers_count too). Impressions were replaced by "views"; `page_views_total` and
// `page_post_engagements` are still VALID metric names. They legitimately return empty for
// low-activity pages (this venue's FB page appears dormant), so reach/engagement may stay null.
// followers_count is a lifetime field fetched separately (see below).
const FB_PAGE_METRICS = [
  "page_views_total",
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
  // net_followers is always null here — the cron derives it as a WoW delta
  // by comparing the live followers_count to the prior week's snapshot.
  net_followers: number | null;
  link_taps: number | null;
  // Live IG follower count fetched from the user object (not /insights).
  followers_count: number | null;
}

// Fetch IG account-level metrics for a Mon–Sun window.
// since/until are Unix epoch seconds.
// Makes two independent calls:
//   (a) /insights with metric_type=total_value — reach, views, profile_links_taps
//   (b) /{igUserId}?fields=followers_count — live follower snapshot
// Never throws — returns nulls on any error.
export async function fetchIgAccountInsights(
  igUserId: string,
  token: string,
  since: number,
  until: number
): Promise<IgAccountMetrics> {
  const nulls: IgAccountMetrics = { reach: null, views: null, net_followers: null, link_taps: null, followers_count: null };
  let result: IgAccountMetrics = { ...nulls };

  // Call (a): account insights — reach, views, link_taps.
  // Response: { data: [{ name, total_value: { value } }] }
  try {
    const data = await graph(`${igUserId}/insights`, {
      token,
      params: {
        metric: IG_ACCOUNT_METRICS,
        metric_type: "total_value",
        period: "day",
        since: String(since),
        until: String(until),
      },
    });

    // Meta returns data as an array of metric objects keyed by 'name'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byName: Record<string, any> = {};
    if (Array.isArray(data?.data)) {
      for (const m of data.data) byName[m.name] = m;
    }

    // sumMetricValues already handles total_value.value (preferred) and day-period fallback.
    result.reach = sumMetricValues(byName["reach"]);
    result.views = sumMetricValues(byName["views"]);
    result.link_taps = sumMetricValues(byName["profile_links_taps"]);
    // net_followers stays null — derived by the cron as a WoW delta.
  } catch {
    // Call (a) failed — metrics stay null, still attempt follower count.
  }

  // Call (b): live follower count from the user object.
  try {
    const userData = await graph(`${igUserId}`, {
      token,
      params: { fields: "followers_count" },
    });
    result.followers_count = safeInt(userData.followers_count);
  } catch {
    // Non-fatal — followers_count stays null.
  }

  return result;
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
  // Fetch followers_count FIRST, in its own try — it's the one reliable FB number and must
  // survive even if /insights throws (e.g. a deprecated metric). Previously this lived INSIDE
  // the insights try-block, so a deprecated-metric error nulled followers too. (2026-06 fix.)
  let followersCount: number | null = null;
  try {
    const pageData = await graph(pageId, {
      token,
      params: { fields: "followers_count" },
    });
    followersCount = safeInt(pageData.followers_count);
  } catch {
    // Non-fatal — followers_count stays null.
  }

  // Insights metrics (reach/engagement) — independent of the followers fetch above, so a
  // deprecated/empty metric can never take followers_count down with it.
  let reach: number | null = null;
  let engagement: number | null = null;
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

    // reach now maps to page_views_total ("views" — Meta's impressions replacement).
    reach = sumMetricValues(byName["page_views_total"]);
    engagement = sumMetricValues(byName["page_post_engagements"]);
  } catch {
    // Insights metrics unavailable (deprecation / restriction) — reach/engagement stay null,
    // but followers_count (fetched above) is unaffected.
  }

  return { reach, engagement, followers_count: followersCount };
}
