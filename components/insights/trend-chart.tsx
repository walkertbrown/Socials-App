"use client";

// Follower trend — shows a "building history" state until 4 weeks of snapshots exist.
// Once there's enough history, draws the smooth filled-area sparkline from the design
// mock over the cumulative net-follower series, plus the week-over-week headline.

import type { TrendResult } from "@/lib/report/trend";
import { MIN_WEEKS_FOR_TREND } from "@/lib/report/sample-gates";
import { Sparkline } from "@/components/insights/sparkline";

interface TrendChartProps {
  trend: TrendResult;
}

// Turn week-over-week deltas into a cumulative series anchored at 0, so the line
// reads as follower growth over the window rather than a noisy delta scatter.
function cumulative(deltas: number[]): number[] {
  const series = [0];
  let acc = 0;
  for (const d of deltas) {
    acc += d;
    series.push(acc);
  }
  return series;
}

export function TrendDisplay({ trend }: TrendChartProps) {
  const { weeksAvailable, netFollowerTrend, weekOverWeekChange } = trend;
  const wow = weekOverWeekChange.ok ? weekOverWeekChange.value : null;

  return (
    <div className="rounded p-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Follower trend</p>
        {netFollowerTrend.ok && (
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color:
                netFollowerTrend.value.direction === "up"
                  ? "var(--green)"
                  : netFollowerTrend.value.direction === "down"
                  ? "var(--red)"
                  : "var(--text-secondary)",
            }}
          >
            {netFollowerTrend.value.direction === "up"
              ? "trending up"
              : netFollowerTrend.value.direction === "down"
              ? "trending down"
              : "flat"}
          </span>
        )}
      </div>

      {/* Week-over-week headline (available with just 2 weeks) */}
      {wow && (
        <div className="mb-4 flex items-baseline gap-3">
          <span
            className="tabular-nums"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 28, lineHeight: 1, color: "var(--text-primary)" }}
          >
            {wow.delta >= 0 ? "+" : ""}
            {wow.delta.toLocaleString("en-US")}
          </span>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            net followers vs prior week
          </span>
        </div>
      )}

      {/* Multi-week sparkline OR building-history state */}
      {netFollowerTrend.ok ? (
        <div>
          <Sparkline data={cumulative(netFollowerTrend.value.weeklyDeltas)} />
          <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{weeksAvailable}-week trend</span>
            <span>avg. {Math.round(Math.abs(netFollowerTrend.value.avgWeeklyGrowth))} followers/week</span>
          </div>
        </div>
      ) : (
        <div className="rounded px-3 py-2" style={{ background: "var(--surface-hi)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Building history — week{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {weeksAvailable}
            </span>{" "}
            of {MIN_WEEKS_FOR_TREND} needed for trend analysis.
          </p>
        </div>
      )}
    </div>
  );
}
