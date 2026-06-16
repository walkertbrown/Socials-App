import Link from "next/link";
import type { DashboardSummary } from "@/lib/db/dashboard-summary";

interface OverviewCardsProps {
  summary: DashboardSummary;
}

export function OverviewCards({ summary }: OverviewCardsProps) {
  const { pendingReviewCount, upcomingPostCount, latestInsightsWeek } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Link
        href="/board"
        className="group block p-5 transition-colors"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--gold-border)";
          (e.currentTarget as HTMLElement).style.background = "var(--gold-dim)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.background = "var(--surface)";
        }}
      >
        <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--gold)" }}>
          {pendingReviewCount}
        </div>
        <div className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Pending review</div>
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-dim)" }}>Uploads awaiting approval</div>
      </Link>

      <Link
        href="/posts"
        className="group block p-5 transition-colors"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--gold-border)";
          (e.currentTarget as HTMLElement).style.background = "var(--gold-dim)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.background = "var(--surface)";
        }}
      >
        <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--gold)" }}>
          {upcomingPostCount}
        </div>
        <div className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Upcoming posts</div>
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-dim)" }}>Scheduled and ready to publish</div>
      </Link>

      <Link
        href={latestInsightsWeek ? `/insights?week=${latestInsightsWeek}` : "/insights"}
        className="group block p-5 transition-colors"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--gold-border)";
          (e.currentTarget as HTMLElement).style.background = "var(--gold-dim)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.background = "var(--surface)";
        }}
      >
        <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--gold)" }}>
          {latestInsightsWeek ?? "—"}
        </div>
        <div className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Latest insights</div>
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-dim)" }}>Most recent analytics week</div>
      </Link>
    </div>
  );
}
