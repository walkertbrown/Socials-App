"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ScreenEyebrow } from "@/components/screen-eyebrow";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, LogOut, MessageCircle } from "lucide-react";
import type { DashboardSummary } from "@/lib/db/dashboard-summary";

interface DashboardClientProps {
  summary: DashboardSummary;
  userEmail: string;
}

export function DashboardClient({ summary, userEmail: _userEmail }: DashboardClientProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-10 pb-4">
        {/* Top-right controls: messages + sign out + theme toggle */}
        <div className="mb-8 flex items-center justify-end gap-3">
          <Link
            href="/messages"
            aria-label="DM Inbox"
            className="flex items-center justify-center rounded-full p-2"
            style={{ color: "var(--text-dim)", background: "var(--surface-hi)", border: "1px solid var(--border)" }}
          >
            <MessageCircle size={14} strokeWidth={1.8} />
          </Link>
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center rounded-full p-2"
            style={{ color: "var(--text-dim)", background: "var(--surface-hi)", border: "1px solid var(--border)" }}
          >
            {theme === "dark"
              ? <Sun size={14} strokeWidth={1.8} />
              : <Moon size={14} strokeWidth={1.8} />}
          </button>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center justify-center rounded-full p-2"
              style={{ color: "var(--text-dim)", background: "var(--surface-hi)", border: "1px solid var(--border)" }}
              aria-label="Sign out"
            >
              <LogOut size={14} strokeWidth={1.8} />
            </button>
          </form>
        </div>

        <ScreenEyebrow
          label="COMMAND CENTER"
          title="Provenance"
          subtitle="Your social media command center."
        />

        <OverviewCards summary={summary} />

        {/* Full-width teal CTA */}
        <div className="mt-6">
          <Link
            href="/board"
            className="btn-teal block w-full rounded py-3 text-center text-sm font-medium"
          >
            Go to Board
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
