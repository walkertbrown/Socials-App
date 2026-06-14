"use client";

// Account-level metrics bar — IG + FB side by side.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function SnapshotBar({ ig, fb }: SnapshotBarProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 text-sm font-medium text-zinc-700">This Week at a Glance</div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="IG Reach" value={fmt(ig?.reach)} />
        <Stat label="IG Views" value={fmt(ig?.views)} />
        <Stat label="Net Followers (IG)" value={fmtSigned(ig?.net_followers)} />
        <Stat label="Link Taps (IG)" value={fmt(ig?.link_taps)} />
        <Stat label="FB Unique Reach" value={fmt(fb?.reach)} />
        <Stat label="FB Engagement" value={fmt(fb?.engagement)} />
      </div>
    </div>
  );
}
