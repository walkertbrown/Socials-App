"use client";

// Account-level metrics for the completed week — editorial ledger grid.
// Instagram metrics carry a green/red week-over-week delta (prior IG snapshot is
// stored); Facebook has no prior-week snapshot, so its numbers show without a delta.
// Audience snapshot is IG-ONLY (FB demographics are unavailable per ground truth).

import type { AccountSnapshot } from "@/lib/db/weekly-snapshots";
import { StatGrid, pctDelta, type Stat } from "@/components/insights/stat-grid";

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
  priorIg?: AccountSnapshot | null;
}

export function SnapshotBar({ ig, fb, priorIg }: SnapshotBarProps) {
  const stats: Stat[] = [
    { label: "IG Reach", value: fmt(ig?.reach), delta: pctDelta(ig?.reach, priorIg?.reach) },
    { label: "IG Views", value: fmt(ig?.views), delta: pctDelta(ig?.views, priorIg?.views) },
    { label: "Net Followers (IG)", value: fmtSigned(ig?.net_followers), delta: pctDelta(ig?.net_followers, priorIg?.net_followers) },
    { label: "Link Taps (IG)", value: fmt(ig?.link_taps), delta: pctDelta(ig?.link_taps, priorIg?.link_taps) },
    { label: "FB Unique Reach", value: fmt(fb?.reach) },
    { label: "FB Engagement", value: fmt(fb?.engagement) },
  ];

  return (
    <section>
      <p className="eyebrow mb-3">This week at a glance</p>
      <StatGrid stats={stats} />
    </section>
  );
}
