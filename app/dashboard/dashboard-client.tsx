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
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#0f3d3e" }}>
            Provenance
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your social media command center.
          </p>
        </div>

        <nav className="flex gap-1 border-b border-zinc-200">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`border-b-2 px-4 py-2 text-sm transition-colors ${
                tab === id
                  ? "border-[#0f3d3e] font-medium text-[#0f3d3e]"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
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
                className="inline-block rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#0f3d3e" }}
              >
                Go to Board
              </Link>
            </div>
          </div>
        )}

        {tab === "studio" && <StudioTab />}

        {tab === "board" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-medium text-zinc-700">Photo Board</div>
            <p className="mt-1 text-xs text-zinc-500">
              Browse and manage your photo library. Pick keepers, add tags, review uploads.
            </p>
            <Link
              href="/board"
              className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#0f3d3e" }}
            >
              Open Board
            </Link>
          </div>
        )}

        {tab === "insights" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-medium text-zinc-700">Weekly Insights</div>
            <p className="mt-1 text-xs text-zinc-500">
              Reach, engagement, top posts, and trend analysis — generated every Monday.
            </p>
            <Link
              href="/insights"
              className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#0f3d3e" }}
            >
              View Insights
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
