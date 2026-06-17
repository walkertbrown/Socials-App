"use client";

// Account-level metrics bar — IG + FB side by side.
// Restyled to spec: 4 teal stat tiles with +delta labels.
// Audience snapshot is IG-ONLY (FB demographics are unavailable per ground truth).

import type { AccountSnapshot } from "@/lib/db/weekly-snapshots";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function fmtSigned(n: number | null | undefined): string {
  if (n == null) return "—";
  return n >= 0 ? `+${n.toLocaleString("en-US")}` : n.toLocaleString("en-US");
}

interface SnapshotBarProps {
  ig: AccountSnapshot | null;
  fb: AccountSnapshot | null;
}

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
}

function StatTile({ label, value, delta }: StatTileProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded p-3"
      style={{ background: "var(--surface-hi)", border: "1px solid var(--border)" }}
    >
      <span className="eyebrow">{label}</span>
      <span className="text-lg font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--gold)" }}>
        {value}
      </span>
      {delta !== undefined && (
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>{delta}</span>
      )}
    </div>
  );
}

export function SnapshotBar({ ig, fb }: SnapshotBarProps) {
  return (
    <div
      className="rounded p-4"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <p className="eyebrow mb-3">This week at a glance</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="IG Reach" value={fmt(ig?.reach)} />
        <StatTile label="IG Views" value={fmt(ig?.views)} />
        <StatTile label="Net Followers (IG)" value={fmtSigned(ig?.net_followers)} />
        <StatTile label="Link Taps (IG)" value={fmt(ig?.link_taps)} />
        <StatTile label="FB Unique Reach" value={fmt(fb?.reach)} />
        <StatTile label="FB Engagement" value={fmt(fb?.engagement)} />
      </div>
    </div>
  );
}
