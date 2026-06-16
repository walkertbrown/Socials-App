"use client";

// Trend display — shows building-history state until 4 weeks of snapshots exist.
// Displays week-over-week follower change as a simple number line, not a chart
// (avoids charting library dependency for v1).

import type { TrendResult } from "@/lib/report/trend";
import { MIN_WEEKS_FOR_TREND } from "@/lib/report/sample-gates";

interface TrendChartProps {
  trend: TrendResult;
}

export function TrendDisplay({ trend }: TrendChartProps) {
  const { weeksAvailable, netFollowerTrend, weekOverWeekChange } = trend;

  // Week-over-week summary (available after 2 weeks).
  const wow = weekOverWeekChange.ok ? weekOverWeekChange.value : null;

  return (
    <div
      className="rounded-lg p-4"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Follower Trend</div>

      {/* Week-over-week (available with just 2 weeks) */}
      {wow && (
        <div className="mb-4 flex items-center gap-3">
          <div className="text-2xl font-semibold tabular-nums" style={{ color: "var(--gold)" }}>
            {wow.delta >= 0 ? "+" : ""}
            {wow.delta.toLocaleString("en-US")}
          </div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>net followers this week vs prior week</div>
        </div>
      )}

      {/* Multi-week trend OR building-history state */}
      {netFollowerTrend.ok ? (
        <div>
          <div className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {weeksAvailable}-week trend
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium"
              style={{
                color:
                  netFollowerTrend.value.direction === "up"
                    ? "var(--green)"
                    : netFollowerTrend.value.direction === "down"
                    ? "var(--red)"
                    : "var(--text-secondary)",
              }}
            >
              {netFollowerTrend.value.direction === "up"
                ? "Growing"
                : netFollowerTrend.value.direction === "down"
                ? "Declining"
                : "Flat"}
            </span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              avg. {Math.round(Math.abs(netFollowerTrend.value.avgWeeklyGrowth))} followers/week
            </span>
          </div>
          {/* Simple sparkline: weekly deltas */}
          <div className="mt-3 flex gap-1">
            {netFollowerTrend.value.weeklyDeltas.map((delta, i) => (
              <div
                key={i}
                title={`${delta >= 0 ? "+" : ""}${delta}`}
                className="h-6 flex-1 rounded-sm"
                style={{
                  background:
                    delta > 0
                      ? "var(--green-dim)"
                      : delta < 0
                      ? "var(--red-dim)"
                      : "var(--surface-hi)",
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="rounded-md px-3 py-2"
          style={{ background: "var(--surface-hi)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Building history — week{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{weeksAvailable}</span> of{" "}
            {MIN_WEEKS_FOR_TREND} needed for trend analysis.
          </p>
        </div>
      )}
    </div>
  );
}
