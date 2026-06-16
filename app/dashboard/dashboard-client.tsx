"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import type { DashboardSummary } from "@/lib/db/dashboard-summary";

interface DashboardClientProps {
  summary: DashboardSummary;
  userEmail: string;
}

export function DashboardClient({ summary, userEmail }: DashboardClientProps) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10">
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

        <OverviewCards summary={summary} />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/studio"
            className="rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-colors"
            style={{ background: "var(--gold)", color: "var(--bg)" }}
          >
            Go to Studio
          </Link>
          <Link
            href="/board"
            className="rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-colors"
            style={{ background: "var(--surface-hi)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            Go to Board
          </Link>
        </div>
      </main>
    </div>
  );
}
