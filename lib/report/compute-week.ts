import "server-only";
import { getPostInsightsForWeek } from "@/lib/db/post-insights";
import { getRecentSnapshots, getSnapshotsByWeek } from "@/lib/db/weekly-snapshots";
import { getReportGoal } from "@/lib/db/report-goal";
import { computeFormatBreakdown, type FormatRow } from "@/lib/report/format-breakdown";
import { computeTimingInsight, type TimingInsight } from "@/lib/report/timing-insight";
import { getTopHashtags, type HashtagResult } from "@/lib/report/hashtag-top";
import { computeTrend, type TrendResult } from "@/lib/report/trend";
import { computeFlag, type FlagResult } from "@/lib/report/flag";
import type { AccountSnapshot } from "@/lib/db/weekly-snapshots";
import type { PostInsightsRow } from "@/lib/db/post-insights";

// The fully assembled week payload — stored in weekly_reports.payload as JSON
// and used by the narratives and PDF renderer. No compute happens at view time.
export interface WeekPayload {
  weekStart: string;    // 'YYYY-MM-DD'
  weekEnd: string;      // 'YYYY-MM-DD'
  goal: string;
  posts: PostInsightsRow[];
  igSnapshot: AccountSnapshot | null;
  fbSnapshot: AccountSnapshot | null;
  priorIgSnapshot: AccountSnapshot | null;
  formatBreakdown: FormatRow[];
  timingInsight: TimingInsight;
  topHashtags: HashtagResult[];
  trend: TrendResult;
  flag: FlagResult;
  // Stories not included in v1 — noted in the report.
  storiesExcluded: true;
}

// Return the Monday (America/Chicago) of the previous week as a Date.
// week offset=0 → previous Mon–Sun; offset=-1 → the week before that.
export function getWeekWindow(weekStart: Date): { since: number; until: number; weekEnd: Date } {
  // since = Monday 00:00 Chicago (as UTC)
  // until = Sunday 23:59:59 Chicago (as UTC)
  // The cron provides the exact weekStart so this just computes the end.
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    since: Math.floor(weekStart.getTime() / 1000),
    until: Math.floor(weekEnd.getTime() / 1000),
    weekEnd,
  };
}

// Format a Date as 'YYYY-MM-DD'.
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Return the Monday of the CURRENT week in America/Chicago.
// Used by the daily snapshot cron to key the upsert row.
export function getCurrentMondayChicago(): Date {
  const now = new Date();
  const chicagoStr = now.toLocaleString("en-US", { timeZone: "America/Chicago" });
  const chicago = new Date(chicagoStr);

  const dow = chicago.getDay(); // 0=Sun, 1=Mon, ...
  const daysToThisMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = new Date(chicago);
  thisMonday.setDate(chicago.getDate() - daysToThisMonday);
  thisMonday.setHours(0, 0, 0, 0);

  return thisMonday;
}

// Return the Monday of the previous week in America/Chicago.
// Used by the cron to determine which week to report on.
export function getPreviousMondayChicago(): Date {
  // Compute "now" in Chicago time by formatting and parsing.
  // This avoids a timezone library dependency.
  const now = new Date();
  const chicagoStr = now.toLocaleString("en-US", { timeZone: "America/Chicago" });
  const chicago = new Date(chicagoStr);

  // Find last Monday.
  const dow = chicago.getDay(); // 0=Sun, 1=Mon, ...
  const daysToLastMonday = dow === 0 ? 6 : dow - 1;
  // Go back to this week's Monday, then subtract 7 more to get last week's Monday.
  const lastMonday = new Date(chicago);
  lastMonday.setDate(chicago.getDate() - daysToLastMonday - 7);
  lastMonday.setHours(0, 0, 0, 0);

  return lastMonday;
}

// Orchestrate all report sections for a given week.
// Does NOT call Claude — just assembles structured data.
// The cron calls this and then stores the result before the Claude calls.
export async function computeWeek(weekStart: Date): Promise<WeekPayload> {
  const weekStartStr = toDateString(weekStart);
  const { weekEnd } = getWeekWindow(weekStart);
  const weekEndStr = toDateString(weekEnd);

  // ── 1. Fetch all posts published in the week ──────────────────────────────
  const posts = await getPostInsightsForWeek(weekStart, weekEnd);

  // ── 2. Fetch account snapshots (already stored by cron before this call) ──
  const snapshots = await getSnapshotsByWeek(weekStartStr);
  const igSnapshot = snapshots.find((s) => s.platform === "instagram") ?? null;
  const fbSnapshot = snapshots.find((s) => s.platform === "facebook") ?? null;

  // ── 3. Fetch historical snapshots for trend computation ────────────────────
  const igHistory = await getRecentSnapshots("instagram", 8);
  const priorIgSnapshot = igHistory.find((s) => s.week_start !== weekStartStr) ?? null;

  // ── 4. Enrich posts with format from media_type/source ────────────────────
  // native-sweep marks source='native'; we use media_type as the format hint.
  const enrichedPosts = posts.map((p) => ({
    ...p,
    format: deriveFormat(p),
  }));

  // ── 5. Compute all sections ────────────────────────────────────────────────
  const goal = await getReportGoal();
  const formatBreakdown = computeFormatBreakdown(enrichedPosts);
  const timingInsight = computeTimingInsight(enrichedPosts);
  const topHashtags = getTopHashtags(enrichedPosts);
  const trend = computeTrend(igHistory, goal);
  const flag = computeFlag(enrichedPosts, igSnapshot, priorIgSnapshot);

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    goal,
    posts: enrichedPosts,
    igSnapshot,
    fbSnapshot,
    priorIgSnapshot,
    formatBreakdown,
    timingInsight,
    topHashtags,
    trend,
    flag,
    storiesExcluded: true,
  };
}

// Derive a display format string from the post's media_type and source.
function deriveFormat(post: PostInsightsRow): string {
  if (post.format) return post.format;
  // Reels are video with delivery; images are the default.
  if (post.media_type === "video") return "reel";
  if (post.media_type === "image") return "image";
  return "image";
}
