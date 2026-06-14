// Timing insight derived from Elizabeth's own post results — NOT from follower
// activity (online_followers is dead / returns empty per ground-truth probe).
//
// This section is sample-gated (n ≥ 5) and labeled "based on your post results,"
// never "when your followers are online."

import {
  formatGate,
  type GatedValue,
  MIN_POSTS_PER_FORMAT,
} from "@/lib/report/sample-gates";
import type { PostInsightsRow } from "@/lib/db/post-insights";

export interface TimingInsight {
  // Best day-of-week by median reach — gated.
  bestDayByReach: GatedValue<{ day: string; medianReach: number; sampleSize: number }>;
  // Best hour bucket by median reach — gated.
  bestHourByReach: GatedValue<{ hourLabel: string; medianReach: number; sampleSize: number }>;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function medianOf(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Compute timing insight from Elizabeth's own published posts.
// Uses all historical published posts (not just the current week) so the
// sample gate is more achievable.
export function computeTimingInsight(posts: PostInsightsRow[]): TimingInsight {
  // Only use posts that have both a published_at timestamp and a reach value.
  const withData = posts.filter((p) => p.published_at != null && p.reach != null);

  // Group reach values by day-of-week.
  const byDay: Map<number, number[]> = new Map();
  // Group reach values by hour bucket (3-hour windows: 0, 3, 6, 9, 12, 15, 18, 21).
  const byHour: Map<number, number[]> = new Map();

  for (const p of withData) {
    const dt = new Date(p.published_at!);
    const dow = dt.getDay(); // 0=Sun
    const hour = Math.floor(dt.getHours() / 3) * 3; // bucket to nearest 3h

    if (!byDay.has(dow)) byDay.set(dow, []);
    byDay.get(dow)!.push(p.reach!);

    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)!.push(p.reach!);
  }

  // Find the best day bucket with enough samples.
  let bestDay: { day: string; medianReach: number; sampleSize: number } | null = null;
  let bestDayMedian = -1;
  for (const [dow, reaches] of byDay) {
    const med = medianOf(reaches);
    if (med > bestDayMedian) {
      bestDayMedian = med;
      bestDay = { day: DAY_NAMES[dow], medianReach: med, sampleSize: reaches.length };
    }
  }

  const totalDayPosts = withData.length;
  const bestDayResult: GatedValue<typeof bestDay> = bestDay && totalDayPosts >= MIN_POSTS_PER_FORMAT
    ? { ok: true, value: bestDay }
    : { ok: false, reason: "not_enough_data" };

  // Find the best hour bucket with enough samples.
  let bestHour: { hourLabel: string; medianReach: number; sampleSize: number } | null = null;
  let bestHourMedian = -1;
  for (const [hour, reaches] of byHour) {
    const med = medianOf(reaches);
    if (med > bestHourMedian) {
      bestHourMedian = med;
      const label = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "am" : "pm"}–${(hour + 3) === 24 ? "12am" : (hour + 3) > 12 ? `${hour + 3 - 12}pm` : `${hour + 3}am`}`;
      bestHour = { hourLabel: label, medianReach: med, sampleSize: reaches.length };
    }
  }

  const bestHourResult: GatedValue<typeof bestHour> = bestHour && totalDayPosts >= MIN_POSTS_PER_FORMAT
    ? { ok: true, value: bestHour }
    : { ok: false, reason: "not_enough_data" };

  return {
    bestDayByReach: bestDayResult as GatedValue<{ day: string; medianReach: number; sampleSize: number }>,
    bestHourByReach: bestHourResult as GatedValue<{ hourLabel: string; medianReach: number; sampleSize: number }>,
  };
}
