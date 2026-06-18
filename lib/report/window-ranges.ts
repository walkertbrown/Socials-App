// Pure date-math helpers for the insights time-window selector.
// No DB or API calls here — just range computation.

export type WindowKey = "daily" | "weekly" | "monthly" | "alltime";

export interface WindowRange {
  since: number;
  until: number;
  label: string;
}

// Labels shown in the strip eyebrow (above the tiles).
export const WINDOW_LABELS: Record<WindowKey, string> = {
  daily: "TODAY SO FAR",
  weekly: "THIS WEEK SO FAR",
  monthly: "LAST 30 DAYS",
  alltime: "ALL TIME (SINCE JUN 1)",
};

// Return the UTC Date corresponding to 00:00 today in America/Chicago.
// Uses formatToParts to read the elapsed ms since Chicago midnight and subtracts
// from now — never calls new Date(localeString), which would parse in the host
// timezone (UTC on Vercel) instead of Chicago's.
function todayMidnightChicago(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const h = get("hour") % 24; // handle 24:00 edge (midnight itself)
  const msSinceMidnight = (h * 3600 + get("minute") * 60 + get("second")) * 1000;
  return new Date(now.getTime() - msSinceMidnight);
}

// Return the Monday of the current week in America/Chicago.
// Inlined here (rather than imported from compute-week) so this module
// stays free of `server-only` and can be used by client components.
function currentMondayChicago(): Date {
  const now = new Date();
  const chicagoStr = now.toLocaleString("en-US", { timeZone: "America/Chicago" });
  const chicago = new Date(chicagoStr);
  const dow = chicago.getDay(); // 0=Sun, 1=Mon, ...
  const daysBack = dow === 0 ? 6 : dow - 1;
  const monday = new Date(chicago);
  monday.setDate(chicago.getDate() - daysBack);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Return the since/until Unix timestamps (seconds) for a given window key.
// "alltime" is a stored-data window — no live Meta call needed.
// Return since=0, until=0 as a sentinel; the caller must handle it differently.
export function windowRange(key: WindowKey): WindowRange {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  if (key === "alltime") {
    return { since: 0, until: 0, label: WINDOW_LABELS.alltime };
  }

  if (key === "monthly") {
    const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    return {
      since: Math.floor(thirtyDaysAgoMs / 1000),
      until: nowSec,
      label: WINDOW_LABELS.monthly,
    };
  }

  if (key === "weekly") {
    const monday = currentMondayChicago();
    return {
      since: Math.floor(monday.getTime() / 1000),
      until: nowSec,
      label: WINDOW_LABELS.weekly,
    };
  }

  // "daily": today 00:00 America/Chicago -> now.
  // We compute midnight by subtracting "ms elapsed since Chicago midnight" from
  // now — avoids new Date(localeString) which parses in the HOST timezone, not
  // Chicago's, so it fails on Vercel's UTC servers.
  const midnight = todayMidnightChicago();
  return {
    since: Math.floor(midnight.getTime() / 1000),
    until: nowSec,
    label: WINDOW_LABELS.daily,
  };
}

// Shared payload shape — used by both the API route response and the strip component.
// Fields that cannot be computed for a given window are null (tile renders "—").
export interface StripPayload {
  ig_reach: number | null;
  ig_views: number | null;
  ig_followers_count: number | null;
  ig_net_followers: number | null;
  ig_link_taps: number | null;
  fb_reach: number | null;
  fb_engagement: number | null;
  fb_followers_count: number | null;
  fb_net_followers: number | null;
  ig_posts_published: number | null;
  fetched_at: string;
}
