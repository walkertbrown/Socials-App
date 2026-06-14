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
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 text-sm font-medium text-zinc-700">Follower Trend</div>

      {/* Week-over-week (available with just 2 weeks) */}
      {wow && (
        <div className="mb-4 flex items-center gap-3">
          <div className="text-2xl font-semibold tabular-nums">
            {wow.delta >= 0 ? "+" : ""}
            {wow.delta.toLocaleString("en-US")}
          </div>
          <div className="text-sm text-zinc-500">net followers this week vs prior week</div>
        </div>
      )}

      {/* Multi-week trend OR building-history state */}
      {netFollowerTrend.ok ? (
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500">
            {weeksAvailable}-week trend
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                netFollowerTrend.value.direction === "up"
                  ? "text-green-600"
                  : netFollowerTrend.value.direction === "down"
                  ? "text-red-500"
                  : "text-zinc-500"
              }`}
            >
              {netFollowerTrend.value.direction === "up"
                ? "Growing"
                : netFollowerTrend.value.direction === "down"
                ? "Declining"
                : "Flat"}
            </span>
            <span className="text-sm text-zinc-500">
              avg. {Math.round(Math.abs(netFollowerTrend.value.avgWeeklyGrowth))} followers/week
            </span>
          </div>
          {/* Simple sparkline: weekly deltas */}
          <div className="mt-3 flex gap-1">
            {netFollowerTrend.value.weeklyDeltas.map((delta, i) => (
              <div
                key={i}
                title={`${delta >= 0 ? "+" : ""}${delta}`}
                className={`h-6 flex-1 rounded-sm ${
                  delta > 0 ? "bg-green-200" : delta < 0 ? "bg-red-200" : "bg-zinc-100"
                }`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-zinc-50 px-3 py-2">
          <p className="text-sm text-zinc-500">
            Building history — week{" "}
            <span className="font-medium">{weeksAvailable}</span> of{" "}
            {MIN_WEEKS_FOR_TREND} needed for trend analysis.
          </p>
        </div>
      )}
    </div>
  );
}
