"use client";

// Client-side insights viewer.
// All data is already stored — this component NEVER computes or calls Claude.
// Reads from the already-stored weekly_reports row passed from the server.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WeeklyReport } from "@/lib/db/weekly-reports";
import type { WeekPayload } from "@/lib/report/compute-week";
import type { DemographicsSnapshot } from "@/lib/meta/demographics";
import { SnapshotBar } from "@/components/insights/snapshot-bar";
import { FormatTable, TopPostList } from "@/components/insights/post-table";
import { AudienceSnapshot } from "@/components/insights/audience-snapshot";
import { TrendDisplay } from "@/components/insights/trend-chart";

interface InsightsClientProps {
  report: WeeklyReport | null;
  availableWeeks: string[];
}

export function InsightsClient({ report, availableWeeks }: InsightsClientProps) {
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState(report?.week_start ?? "");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const payload = report?.payload as WeekPayload | null;

  async function handleDownloadPdf() {
    if (!report) return;
    window.location.href = `/api/reports/${report.week_start}/pdf`;
  }

  async function handleRegenerate() {
    if (!report) return;
    setIsRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: report.week_start }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRegenError(err.error ?? "Regeneration failed.");
      } else {
        router.refresh();
      }
    } catch {
      setRegenError("Network error — please try again.");
    } finally {
      setIsRegenerating(false);
    }
  }

  function handleWeekChange(week: string) {
    setSelectedWeek(week);
    router.push(`/insights?week=${week}`);
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!report || !payload) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
        <Header availableWeeks={availableWeeks} selectedWeek={selectedWeek} onWeekChange={handleWeekChange} />
        <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
          <p className="text-lg font-medium text-zinc-700">No weekly report yet.</p>
          <p className="mt-2 text-sm text-zinc-500">
            The first report generates after the weekly cron runs (every Monday morning).
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Stories are not included. Trend analysis builds after 4 weeks of data.
          </p>
        </div>
      </div>
    );
  }

  const igSnap = payload.igSnapshot;
  const fbSnap = payload.fbSnapshot;
  const demographics = igSnap?.demographics as DemographicsSnapshot | null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <Header
        availableWeeks={availableWeeks}
        selectedWeek={selectedWeek}
        onWeekChange={handleWeekChange}
        onDownload={handleDownloadPdf}
        onRegenerate={handleRegenerate}
        isRegenerating={isRegenerating}
        hasReport={true}
      />

      {regenError && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{regenError}</div>
      )}

      {/* Account snapshot */}
      <SnapshotBar ig={igSnap} fb={fbSnap} />

      {/* Trend */}
      <TrendDisplay trend={payload.trend} />

      {/* Narratives */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NarrativeCard title="Win of the Week" text={report.win_text} pending={!report.narratives_generated_at} />
        <NarrativeCard title="Recommended Focus" text={report.recommend_text} pending={!report.narratives_generated_at} />
      </div>

      {report.flag_text && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-1 text-sm font-medium text-amber-800">Flag of the Week</div>
          <p className="text-sm text-amber-900">{report.flag_text}</p>
        </div>
      )}

      {/* Format breakdown table */}
      <FormatTable rows={payload.formatBreakdown} />

      {/* Top posts */}
      <TopPostList posts={payload.posts} />

      {/* Audience snapshot — IG only */}
      <AudienceSnapshot demographics={demographics} />

      {/* Goal */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        Goal tracked: <span className="font-medium">{payload.goal}</span>
      </div>
    </div>
  );
}

function Header({
  availableWeeks,
  selectedWeek,
  onWeekChange,
  onDownload,
  onRegenerate,
  isRegenerating,
  hasReport,
}: {
  availableWeeks: string[];
  selectedWeek: string;
  onWeekChange: (w: string) => void;
  onDownload?: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  hasReport?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Weekly Insights</h1>
        {availableWeeks.length > 0 && (
          <select
            value={selectedWeek}
            onChange={(e) => onWeekChange(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
          >
            {availableWeeks.map((w) => (
              <option key={w} value={w}>
                Week of {w}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm">
        {hasReport && onDownload && (
          <button
            onClick={onDownload}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-white text-sm hover:bg-zinc-700"
          >
            Download PDF
          </button>
        )}
        {hasReport && onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
        )}
        <Link href="/posts" className="text-zinc-500 underline">
          ← Posts
        </Link>
      </div>
    </div>
  );
}

function NarrativeCard({
  title,
  text,
  pending,
}: {
  title: string;
  text: string | null;
  pending: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-2 text-sm font-medium text-zinc-700">{title}</div>
      {pending ? (
        <p className="text-sm italic text-zinc-400">Narratives generating — check back shortly.</p>
      ) : text ? (
        <p className="text-sm leading-relaxed text-zinc-700">{text}</p>
      ) : (
        <p className="text-sm italic text-zinc-400">Not yet generated.</p>
      )}
    </div>
  );
}
