import Link from "next/link";
import type { DashboardSummary } from "@/lib/db/dashboard-summary";

interface OverviewCardsProps {
  summary: DashboardSummary;
}

export function OverviewCards({ summary }: OverviewCardsProps) {
  const { pendingReviewCount, upcomingPostCount, latestInsightsWeek } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Link href="/board" className="group block rounded-xl border border-zinc-200 bg-white p-5 hover:border-[#0f3d3e]/40 transition-colors">
        <div className="text-3xl font-bold" style={{ color: "#0f3d3e" }}>
          {pendingReviewCount}
        </div>
        <div className="mt-1 text-sm font-medium text-zinc-700">Pending review</div>
        <div className="mt-0.5 text-xs text-zinc-400">Uploads awaiting approval</div>
      </Link>

      <Link href="/posts" className="group block rounded-xl border border-zinc-200 bg-white p-5 hover:border-[#0f3d3e]/40 transition-colors">
        <div className="text-3xl font-bold" style={{ color: "#0f3d3e" }}>
          {upcomingPostCount}
        </div>
        <div className="mt-1 text-sm font-medium text-zinc-700">Upcoming posts</div>
        <div className="mt-0.5 text-xs text-zinc-400">Scheduled and ready to publish</div>
      </Link>

      <Link
        href={latestInsightsWeek ? `/insights?week=${latestInsightsWeek}` : "/insights"}
        className="group block rounded-xl border border-zinc-200 bg-white p-5 hover:border-[#0f3d3e]/40 transition-colors"
      >
        <div className="text-3xl font-bold" style={{ color: "#0f3d3e" }}>
          {latestInsightsWeek ?? "—"}
        </div>
        <div className="mt-1 text-sm font-medium text-zinc-700">Latest insights</div>
        <div className="mt-0.5 text-xs text-zinc-400">Most recent analytics week</div>
      </Link>
    </div>
  );
}
