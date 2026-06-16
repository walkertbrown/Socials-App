"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { StudioTab } from "@/components/dashboard/studio-tab";
import type { DashboardSummary } from "@/lib/db/dashboard-summary";

type Tab = "overview" | "studio" | "board" | "insights";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "studio", label: "Studio" },
  { id: "board", label: "Board" },
  { id: "insights", label: "Insights" },
];

interface DashboardClientProps {
  summary: DashboardSummary;
  userEmail: string;
}

export function DashboardClient({ summary, userEmail }: DashboardClientProps) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <h1
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--text-primary)" }}
          >
            Provenance
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Your social media command center.
          </p>
        </div>

        <nav className="flex gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="border-b-2 px-4 py-2 text-sm transition-colors"
              style={
                tab === id
                  ? { borderColor: "var(--gold)", fontWeight: 500, color: "var(--gold)" }
                  : { borderColor: "transparent", color: "var(--text-dim)" }
              }
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <div className="flex flex-col gap-5">
            <OverviewCards summary={summary} />
            <div>
              <Link
                href="/board"
                className="inline-block rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
                style={{ background: "var(--gold)", color: "var(--bg)" }}
              >
                Go to Board
              </Link>
            </div>
          </div>
        )}

        {tab === "studio" && <StudioTab />}

        {tab === "board" && (
          <div
            className="rounded-xl p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          >
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Photo Board</div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Browse and manage your photo library. Pick keepers, add tags, review uploads.
            </p>
            <Link
              href="/board"
              className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
              style={{ background: "var(--gold)", color: "var(--bg)" }}
            >
              Open Board
            </Link>
          </div>
        )}

        {tab === "insights" && (
          <div
            className="rounded-xl p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          >
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Weekly Insights</div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Reach, engagement, top posts, and trend analysis — generated every Monday.
            </p>
            <Link
              href="/insights"
              className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
              style={{ background: "var(--gold)", color: "var(--bg)" }}
            >
              View Insights
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
