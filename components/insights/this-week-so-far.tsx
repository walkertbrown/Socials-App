"use client";

// "This week so far" strip — shows current week's headline account metrics.
// Data is pre-fetched server-side and passed in; no client-side fetching here.
// Refreshed daily by the home-server cron at ~6:10am Chicago.

import type { DailySnapshot } from "@/lib/db/daily-snapshots";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function fmtSigned(n: number | null | undefined): string {
  if (n == null) return "—";
  return n >= 0 ? `+${n.toLocaleString("en-US")}` : n.toLocaleString("en-US");
}

// Format a timestamptz string into a readable "as of" label.
// e.g. "as of Jun 17, 2026 at 6:12 AM"
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

interface StatTileProps {
  label: string;
  value: string;
}

function StatTile({ label, value }: StatTileProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded p-3"
      // --gold is actually the teal palette (named --gold for surgical compat — see globals.css)
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

interface ThisWeekSoFarProps {
  snapshots: DailySnapshot[];
}

export function ThisWeekSoFar({ snapshots }: ThisWeekSoFarProps) {
  const ig = snapshots.find((s) => s.platform === "instagram") ?? null;
  const fb = snapshots.find((s) => s.platform === "facebook") ?? null;

  // Use IG captured_at for the label; fall back to FB if IG is absent.
  const capturedAt = ig?.captured_at ?? fb?.captured_at ?? null;

  return (
    <div
      className="rounded p-4"
      style={{ border: "1px solid var(--gold-border)", background: "var(--surface)" }}
    >
      {/* --gold is the teal palette per globals.css */}
      <p className="eyebrow mb-1" style={{ color: "var(--gold)" }}>THIS WEEK SO FAR</p>

      {!ig && !fb ? (
        <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
          No live numbers yet — daily refresh runs each morning.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="IG Reach" value={fmt(ig?.reach)} />
            <StatTile label="IG Views" value={fmt(ig?.views)} />
            <StatTile label="Net Followers (IG)" value={fmtSigned(ig?.net_followers)} />
            <StatTile label="Link Taps (IG)" value={fmt(ig?.link_taps)} />
            <StatTile label="FB Unique Reach" value={fmt(fb?.reach)} />
            <StatTile label="FB Engagement" value={fmt(fb?.engagement)} />
          </div>

          {capturedAt && (
            <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
              as of {fmtCapturedAt(capturedAt)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
