// Multi-week trend analysis vs the report goal (default: net follower growth).
// Requires ≥4 weeks of snapshot history before showing any trend — shows a
// "building history (week X of 4)" state before that threshold is met.

import {
  MIN_WEEKS_FOR_TREND,
  type GatedValue,
  BUILDING_HISTORY,
} from "@/lib/report/sample-gates";
import type { AccountSnapshot } from "@/lib/db/weekly-snapshots";

export interface TrendResult {
  // How many weeks of data we have (used to compute "building history week X of 4").
  weeksAvailable: number;
  // Gated trend value — only set when weeksAvailable ≥ 4.
  netFollowerTrend: GatedValue<{
    // Week-over-week change in net followers for each of the last N weeks.
    weeklyDeltas: number[];
    // Simple direction: 'up' | 'down' | 'flat'
    direction: "up" | "down" | "flat";
    // Average weekly net follower change.
    avgWeeklyGrowth: number;
  }>;
  // Current week net followers vs prior week.
  weekOverWeekChange: GatedValue<{ current: number; prior: number; delta: number }>;
}

// Compute trend metrics from the stored snapshot history for IG.
// Snapshots should be ordered newest-first (as returned by getRecentSnapshots).
export function computeTrend(
  igSnapshots: AccountSnapshot[],
  goal: string
): TrendResult {
  const weeksAvailable = igSnapshots.length;

  if (weeksAvailable < 2) {
    return {
      weeksAvailable,
      netFollowerTrend: BUILDING_HISTORY,
      weekOverWeekChange: BUILDING_HISTORY,
    };
  }

  // Week-over-week: compare this week (index 0) vs last week (index 1).
  const current = igSnapshots[0].net_followers ?? 0;
  const prior = igSnapshots[1].net_followers ?? 0;
  const delta = current - prior;

  const weekOverWeekChange: GatedValue<{ current: number; prior: number; delta: number }> = {
    ok: true,
    value: { current, prior, delta },
  };

  if (weeksAvailable < MIN_WEEKS_FOR_TREND) {
    return {
      weeksAvailable,
      netFollowerTrend: BUILDING_HISTORY,
      weekOverWeekChange,
    };
  }

  // Full trend: compute week-over-week deltas across all available weeks.
  const weeklyDeltas: number[] = [];
  for (let i = 0; i < weeksAvailable - 1; i++) {
    const curr = igSnapshots[i].net_followers ?? 0;
    const prev = igSnapshots[i + 1].net_followers ?? 0;
    weeklyDeltas.push(curr - prev);
  }

  const avgWeeklyGrowth =
    weeklyDeltas.reduce((s, v) => s + v, 0) / weeklyDeltas.length;

  const direction: "up" | "down" | "flat" =
    avgWeeklyGrowth > 0 ? "up" : avgWeeklyGrowth < 0 ? "down" : "flat";

  return {
    weeksAvailable,
    netFollowerTrend: {
      ok: true,
      value: { weeklyDeltas, direction, avgWeeklyGrowth },
    },
    weekOverWeekChange,
  };
}
