// Sample-size guards for the weekly insights report.
//
// These are non-negotiable adversary requirements:
//   - Median reach / any vs-baseline comparison: n ≥ 5 per format.
//   - Percent-of-baseline comparisons: 4+ weeks of snapshot history.
//   - Below thresholds: show "not enough data yet" instead of a number.

// Minimum posts in a format bucket to report a median or comparison.
export const MIN_POSTS_PER_FORMAT = 5;

// Minimum weeks of snapshot history to show a percent-of-baseline trend.
export const MIN_WEEKS_FOR_TREND = 4;

export type GatedValue<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "not_enough_data" | "building_history" };

export const NOT_ENOUGH_DATA: GatedValue<never> = {
  ok: false,
  reason: "not_enough_data",
};

export const BUILDING_HISTORY: GatedValue<never> = {
  ok: false,
  reason: "building_history",
};

// Return the human-readable placeholder text for a gated value.
export function gatedLabel(g: GatedValue<unknown>): string {
  if (g.ok) return String((g as { ok: true; value: unknown }).value);
  if (g.reason === "building_history") return "building history";
  return "not enough data yet";
}

// Gate: n ≥ MIN_POSTS_PER_FORMAT to show median/comparison for this format.
export function formatGate<T>(n: number, value: T): GatedValue<T> {
  if (n < MIN_POSTS_PER_FORMAT) return NOT_ENOUGH_DATA;
  return { ok: true, value };
}

// Gate: snapshotWeeks ≥ MIN_WEEKS_FOR_TREND to show percent-of-baseline.
export function trendGate<T>(snapshotWeeks: number, value: T, weekIndex: number): GatedValue<T> {
  if (snapshotWeeks < MIN_WEEKS_FOR_TREND) {
    return {
      ok: false,
      reason: "building_history",
    };
  }
  return { ok: true, value };
}

// Compute median of a numeric array. Returns null for empty arrays.
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Group posts by format and return { format → posts[] } map.
export function groupByFormat<T extends { format: string | null }>(
  posts: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const p of posts) {
    const f = p.format ?? "unknown";
    if (!map.has(f)) map.set(f, []);
    map.get(f)!.push(p);
  }
  return map;
}
