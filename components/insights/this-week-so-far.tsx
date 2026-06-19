"use client";

// "This week so far" strip — live account numbers with a time-window selector.
// Weekly data is server-passed via `snapshots` (no fetch on initial load).
// Daily / monthly windows fetch live from /api/insights/account (cached 30 min).
// All-time window sums stored weekly_account_snapshots rows (no live Meta call).
// Restyled to the editorial ledger grid (serif numbers) from the design mock.

import { useState } from "react";
import type { DailySnapshot } from "@/lib/db/daily-snapshots";
import type { WindowKey, StripPayload } from "@/lib/report/window-ranges";
import { WINDOW_LABELS } from "@/lib/report/window-ranges";
import { WindowSelector } from "@/components/insights/window-selector";
import { StatGrid, type Stat } from "@/components/insights/stat-grid";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"; // em-dash rendered as character (not typed)
  return n.toLocaleString("en-US");
}

function fmtSigned(n: number | null | undefined): string {
  if (n == null) return "—";
  return n >= 0 ? `+${n.toLocaleString("en-US")}` : n.toLocaleString("en-US");
}

function fmtCapturedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

// ── Per-window stat builders ──────────────────────────────────────────────────

function liveStats(data: StripPayload | null, loading: boolean): Stat[] {
  const v = (val: string) => (loading ? "…" : val);
  return [
    { label: "IG Reach", value: v(fmt(data?.ig_reach)) },
    { label: "IG Views", value: v(fmt(data?.ig_views)) },
    { label: "IG Followers", value: v(fmt(data?.ig_followers_count)) },
    { label: "IG Link Taps", value: v(fmt(data?.ig_link_taps)) },
    { label: "FB Reach", value: v(fmt(data?.fb_reach)) },
    { label: "FB Engagement", value: v(fmt(data?.fb_engagement)) },
  ];
}

function allTimeStats(data: StripPayload | null, loading: boolean): Stat[] {
  const v = (val: string) => (loading ? "…" : val);
  return [
    { label: "IG Views", value: v(fmt(data?.ig_views)) },
    { label: "IG Follower Growth", value: v(fmtSigned(data?.ig_net_followers)) },
    { label: "IG Posts Published", value: v(fmt(data?.ig_posts_published)) },
    { label: "FB Views", value: v("—") },
    { label: "FB Follower Growth", value: v(fmtSigned(data?.fb_net_followers)) },
    { label: "FB Engagement", value: v(fmt(data?.fb_engagement)) },
  ];
}

function weeklyStats(snapshots: DailySnapshot[]): Stat[] {
  const ig = snapshots.find((s) => s.platform === "instagram") ?? null;
  const fb = snapshots.find((s) => s.platform === "facebook") ?? null;
  return [
    { label: "IG Reach", value: fmt(ig?.reach) },
    { label: "IG Views", value: fmt(ig?.views) },
    { label: "Net Followers (IG)", value: fmtSigned(ig?.net_followers) },
    { label: "Link Taps (IG)", value: fmt(ig?.link_taps) },
    { label: "FB Unique Reach", value: fmt(fb?.reach) },
    { label: "FB Engagement", value: fmt(fb?.engagement) },
  ];
}

// ── Main component ────────────────────────────────────────────────────────────

interface ThisWeekSoFarProps {
  snapshots: DailySnapshot[];
}

export function ThisWeekSoFar({ snapshots }: ThisWeekSoFarProps) {
  const [windowKey, setWindowKey] = useState<WindowKey>("weekly");
  const [liveData, setLiveData] = useState<StripPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const ig = snapshots.find((s) => s.platform === "instagram") ?? null;
  const fb = snapshots.find((s) => s.platform === "facebook") ?? null;
  const weeklyCapturedAt = ig?.captured_at ?? fb?.captured_at ?? null;

  async function fetchWindow(key: WindowKey) {
    if (key === "weekly") {
      // Weekly uses the server-passed snapshot prop — no fetch needed.
      setLiveData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/insights/account?window=${key}`);
      if (res.ok) {
        setLiveData((await res.json()) as StripPayload);
      } else {
        setLiveData(null);
      }
    } catch {
      setLiveData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleWindowChange(key: WindowKey) {
    setWindowKey(key);
    void fetchWindow(key);
  }

  function asOfLabel(): string | null {
    if (windowKey === "alltime") return "accumulated since Jun 1, 2026";
    if (windowKey === "weekly") return weeklyCapturedAt ? `as of ${fmtCapturedAt(weeklyCapturedAt)}` : null;
    if (liveData?.fetched_at) return `as of ${fmtCapturedAt(liveData.fetched_at)}`;
    return null;
  }

  const hasWeeklyData = ig !== null || fb !== null;
  const showWeeklyEmpty = windowKey === "weekly" && !hasWeeklyData;

  const stats =
    windowKey === "weekly"
      ? weeklyStats(snapshots)
      : windowKey === "alltime"
      ? allTimeStats(liveData, loading)
      : liveStats(liveData, loading);

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="eyebrow" style={{ color: "var(--gold)" }}>
          {WINDOW_LABELS[windowKey]}
        </p>
        <WindowSelector value={windowKey} onChange={handleWindowChange} />
      </div>

      {showWeeklyEmpty ? (
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          No live numbers yet — daily refresh runs each morning.
        </p>
      ) : (
        <StatGrid stats={stats} />
      )}

      {windowKey === "alltime" && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
          Reach not shown — unique-reach can&apos;t be summed across weeks.
        </p>
      )}

      {asOfLabel() && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
          {asOfLabel()}
        </p>
      )}
    </section>
  );
}
