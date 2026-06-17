import Link from "next/link";
import type { DashboardSummary } from "@/lib/db/dashboard-summary";

interface OverviewCardsProps {
  summary: DashboardSummary;
}

interface StatRowProps {
  href: string;
  value: number | string;
  label: string;
  sub: string;
}

// Single stat row — teal value, plain label, dim sub-label.
// Spec shows stacked rows rather than a 3-column grid.
function StatRow({ href, value, label, sub }: StatRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded p-4 transition-colors"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
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
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</div>
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-dim)" }}>{sub}</div>
      </div>
      <div
        className="text-2xl font-semibold tabular-nums"
        style={{ fontFamily: "var(--font-mono)", color: "var(--gold)" }}
      >
        {value}
      </div>
    </Link>
  );
}

export function OverviewCards({ summary }: OverviewCardsProps) {
  const { pendingReviewCount, upcomingPostCount, latestInsightsWeek } = summary;

  return (
    <div className="flex flex-col gap-3">
      <StatRow
        href="/board"
        value={pendingReviewCount}
        label="Pending review"
        sub="Uploads awaiting approval"
      />
      <StatRow
        href="/posts"
        value={upcomingPostCount}
        label="Upcoming posts"
        sub="Scheduled and ready to publish"
      />
      <StatRow
        href={latestInsightsWeek ? `/insights?week=${latestInsightsWeek}` : "/insights"}
        value={latestInsightsWeek ?? "—"}
        label="Latest insights"
        sub="Most recent analytics week"
      />
    </div>
  );
}
