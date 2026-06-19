"use client";

// Client-side insights viewer.
// All data is already stored — this component NEVER computes or calls Claude.
// Reads from the already-stored weekly_reports row passed from the server.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WeeklyReport } from "@/lib/db/weekly-reports";
import { AppShell } from "@/components/app-shell";
import type { WeekPayload } from "@/lib/report/compute-week";
import type { DemographicsSnapshot } from "@/lib/meta/demographics";
import { SnapshotBar } from "@/components/insights/snapshot-bar";
import { ThisWeekSoFar } from "@/components/insights/this-week-so-far";
import type { DailySnapshot } from "@/lib/db/daily-snapshots";
import { FormatTable, TopPostList } from "@/components/insights/post-table";
import { AudienceSnapshot } from "@/components/insights/audience-snapshot";
import { TrendDisplay } from "@/components/insights/trend-chart";
import { Trophy, Flag } from "lucide-react";

interface InsightsClientProps {
  report: WeeklyReport | null;
  availableWeeks: string[];
  userEmail?: string;
  dailySnapshots?: DailySnapshot[];
}

export function InsightsClient({ report, availableWeeks, userEmail: _userEmail = "", dailySnapshots = [] }: InsightsClientProps) {
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
  // Still render the "This week so far" strip even when no completed weekly report exists.
  if (!report || !payload) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
          <InsightsTitle eyebrow="Weekly report" />
          <InsightsHeader
            availableWeeks={availableWeeks}
            selectedWeek={selectedWeek}
            onWeekChange={handleWeekChange}
          />
          <ThisWeekSoFar snapshots={dailySnapshots} />
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
              No weekly report yet.
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Not enough data yet — the first report generates after the weekly cron runs.
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
              Stories are not included. Trend analysis builds after 4 weeks of data.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const igSnap = payload.igSnapshot;
  const fbSnap = payload.fbSnapshot;
  const demographics = igSnap?.demographics as DemographicsSnapshot | null;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <InsightsTitle eyebrow={fmtRange(report.week_start, payload.weekEnd)} chip="This week" />

        <InsightsHeader
          availableWeeks={availableWeeks}
          selectedWeek={selectedWeek}
          onWeekChange={handleWeekChange}
          onDownload={handleDownloadPdf}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
          hasReport
        />

        {regenError && (
          <div className="rounded px-4 py-2 text-sm" style={{ background: "var(--red-dim)", color: "var(--red)" }}>
            {regenError}
          </div>
        )}

        {/* This week so far — live daily numbers above the completed-week report */}
        <ThisWeekSoFar snapshots={dailySnapshots} />

        {/* Account snapshot — completed week (IG deltas vs prior week) */}
        <SnapshotBar ig={igSnap} fb={fbSnap} priorIg={payload.priorIgSnapshot} />

        {/* Trend */}
        <TrendDisplay trend={payload.trend} />

        {/* Narratives */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <WinOfWeekCard title="Win of the Week" text={report.win_text} pending={!report.narratives_generated_at} />
          <NarrativeCard title="Recommended Focus" text={report.recommend_text} pending={!report.narratives_generated_at} />
        </div>

        {report.flag_text && (
          <div className="rounded p-4" style={{ border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)" }}>
            <div className="mb-1 flex items-center gap-1.5">
              <Flag size={12} strokeWidth={2} style={{ color: "var(--red)" }} />
              <p className="eyebrow" style={{ color: "var(--red)" }}>Flag of the week</p>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{report.flag_text}</p>
          </div>
        )}

        <FormatTable rows={payload.formatBreakdown} />
        <TopPostList posts={payload.posts} />
        <AudienceSnapshot demographics={demographics} />

        <div className="rounded px-4 py-3 text-sm" style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
          Goal tracked: <span className="font-medium" style={{ color: "var(--text-primary)" }}>{payload.goal}</span>
        </div>
      </div>
    </AppShell>
  );
}

// Format a Mon–Sun date range as "Jun 9 — Jun 15" (UTC: these are plain date strings).
function fmtRange(startISO: string, endISO: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  try {
    const s = new Date(`${startISO}T00:00:00Z`).toLocaleDateString("en-US", opts);
    const e = new Date(`${endISO}T00:00:00Z`).toLocaleDateString("en-US", opts);
    return `${s} — ${e}`;
  } catch {
    return "Weekly report";
  }
}

// Editorial page header — date-range eyebrow, serif title, optional "This week" chip.
function InsightsTitle({ eyebrow, chip }: { eyebrow: string; chip?: string }) {
  return (
    <div className="flex items-start justify-between pt-6">
      <div>
        <p className="eyebrow mb-1">{eyebrow}</p>
        <h1
          className="text-2xl tracking-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 500, color: "var(--text-primary)" }}
        >
          Insights
        </h1>
      </div>
      {chip && (
        <span
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            padding: "3px 9px",
            borderRadius: 4,
            border: "1px solid var(--gold-border)",
            background: "var(--gold-dim)",
            color: "var(--gold)",
          }}
        >
          {chip}
        </span>
      )}
    </div>
  );
}

function InsightsHeader({
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
      {availableWeeks.length > 0 && (
        <select
          value={selectedWeek}
          onChange={(e) => onWeekChange(e.target.value)}
          className="rounded px-2 py-1 text-sm"
          style={{ border: "1px solid var(--border-hi)", background: "var(--surface-hi)", color: "var(--text-primary)" }}
        >
          {availableWeeks.map((w) => (
            <option key={w} value={w}>Week of {w}</option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-2 text-sm">
        {hasReport && onDownload && (
          <button onClick={onDownload} className="btn-teal rounded px-3 py-1.5 text-sm font-medium">
            Download PDF
          </button>
        )}
        {hasReport && onRegenerate && (
          <button onClick={onRegenerate} disabled={isRegenerating}
            className="rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
            style={{ border: "1px solid var(--border-hi)", color: "var(--text-secondary)", background: "var(--surface-hi)" }}>
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>
    </div>
  );
}

// WIN OF THE WEEK — highlighted callout card per spec
function WinOfWeekCard({ title, text, pending }: { title: string; text: string | null; pending: boolean }) {
  return (
    <div className="rounded p-4" style={{ border: "1px solid var(--gold-border)", background: "var(--gold-dim)" }}>
      <div className="mb-2 flex items-center gap-1.5">
        <Trophy size={12} strokeWidth={2} style={{ color: "var(--gold)" }} />
        <p className="eyebrow" style={{ color: "var(--gold)" }}>{title}</p>
      </div>
      {pending ? (
        <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>Generating — check back shortly.</p>
      ) : text ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{text}</p>
      ) : (
        <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>Not yet generated.</p>
      )}
    </div>
  );
}

function NarrativeCard({ title, text, pending }: { title: string; text: string | null; pending: boolean }) {
  return (
    <div className="rounded p-4" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="mb-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{title}</div>
      {pending ? (
        <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>Generating — check back shortly.</p>
      ) : text ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{text}</p>
      ) : (
        <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>Not yet generated.</p>
      )}
    </div>
  );
}
