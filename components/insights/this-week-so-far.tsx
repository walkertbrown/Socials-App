"use client";

// "This week so far" strip — orchestrates the time-window selector.
// Weekly data is pre-fetched server-side via the `snapshots` prop (no fetch on initial load).
// Daily / monthly windows fetch live from /api/insights/account (cached 30 min).
// All-time window sums stored weekly_account_snapshots rows (no live Meta call).

import { useState } from "react";
import type { DailySnapshot } from "@/lib/db/daily-snapshots";
import type { WindowKey, StripPayload } from "@/lib/report/window-ranges";
import { WINDOW_LABELS } from "@/lib/report/window-ranges";
import { WindowSelector } from "@/components/insights/window-selector";

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

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string;
}

function StatTile({ label, value }: StatTileProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded p-3"
      style={{ background: "var(--gold-dim)", border: "1px solid var(--gold-border)" }}
    >
      <span className="eyebrow" style={{ color: "var(--gold)" }}>{label}</span>
      <span
        className="text-lg font-semibold tabular-nums"
        style={{ fontFamily: "var(--font-mono)", color: "var(--gold)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Tile grids per window type ────────────────────────────────────────────────

interface LiveTilesProps {
  data: StripPayload | null;
  loading: boolean;
}

function LiveTiles({ data, loading }: LiveTilesProps) {
  const v = (val: string) => (loading ? "..." : val);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile label="IG Reach" value={v(fmt(data?.ig_reach))} />
      <StatTile label="IG Views" value={v(fmt(data?.ig_views))} />
      <StatTile label="IG Followers" value={v(fmt(data?.ig_followers_count))} />
      <StatTile label="IG Link Taps" value={v(fmt(data?.ig_link_taps))} />
      <StatTile label="FB Reach" value={v(fmt(data?.fb_reach))} />
      <StatTile label="FB Engagement" value={v(fmt(data?.fb_engagement))} />
    </div>
  );
}

interface AllTimeTilesProps {
  data: StripPayload | null;
  loading: boolean;
}

function AllTimeTiles({ data, loading }: AllTimeTilesProps) {
  const v = (val: string) => (loading ? "..." : val);
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="IG Views" value={v(fmt(data?.ig_views))} />
        <StatTile label="IG Follower Growth" value={v(fmtSigned(data?.ig_net_followers))} />
        <StatTile label="IG Posts Published" value={v(fmt(data?.ig_posts_published))} />
        <StatTile label="FB Views" value={v("—")} />
        <StatTile label="FB Follower Growth" value={v(fmtSigned(data?.fb_net_followers))} />
        <StatTile label="FB Engagement" value={v(fmt(data?.fb_engagement))} />
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
        Reach not shown — unique-reach can't be summed across weeks.
      </p>
    </>
  );
}

interface WeeklyTilesProps {
  snapshots: DailySnapshot[];
}

function WeeklyTiles({ snapshots }: WeeklyTilesProps) {
  const ig = snapshots.find((s) => s.platform === "instagram") ?? null;
  const fb = snapshots.find((s) => s.platform === "facebook") ?? null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile label="IG Reach" value={fmt(ig?.reach)} />
      <StatTile label="IG Views" value={fmt(ig?.views)} />
      <StatTile label="Net Followers (IG)" value={fmtSigned(ig?.net_followers)} />
      <StatTile label="Link Taps (IG)" value={fmt(ig?.link_taps)} />
      <StatTile label="FB Unique Reach" value={fmt(fb?.reach)} />
      <StatTile label="FB Engagement" value={fmt(fb?.engagement)} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ThisWeekSoFarProps {
  snapshots: DailySnapshot[];
}

export function ThisWeekSoFar({ snapshots }: ThisWeekSoFarProps) {
  const [windowKey, setWindowKey] = useState<WindowKey>("weekly");
  const [liveData, setLiveData] = useState<StripPayload | null>(null);
  const [loading, setLoading] = useState(false);

  // IG captured_at from snapshot (used for the "as of" label in weekly mode).
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
        const data = (await res.json()) as StripPayload;
        setLiveData(data);
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

  // "As of" label — per-window logic.
  function asOfLabel(): string | null {
    if (windowKey === "alltime") return "accumulated since Jun 1, 2026";
    if (windowKey === "weekly") return weeklyCapturedAt ? `as of ${fmtCapturedAt(weeklyCapturedAt)}` : null;
    if (liveData?.fetched_at) return `as of ${fmtCapturedAt(liveData.fetched_at)}`;
    return null;
  }

  const hasWeeklyData = ig !== null || fb !== null;

  return (
    <div
      className="rounded p-4"
      style={{ border: "1px solid var(--gold-border)", background: "var(--surface)" }}
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Eyebrow label changes per window */}
        <p className="eyebrow" style={{ color: "var(--gold)" }}>
          {WINDOW_LABELS[windowKey]}
        </p>
        <WindowSelector value={windowKey} onChange={handleWindowChange} />
      </div>

      {windowKey === "weekly" && !hasWeeklyData ? (
        <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
          No live numbers yet — daily refresh runs each morning.
        </p>
      ) : windowKey === "weekly" ? (
        <WeeklyTiles snapshots={snapshots} />
      ) : windowKey === "alltime" ? (
        <AllTimeTiles data={liveData} loading={loading} />
      ) : (
        <LiveTiles data={liveData} loading={loading} />
      )}

      {asOfLabel() && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
          {asOfLabel()}
        </p>
      )}
    </div>
  );
}
