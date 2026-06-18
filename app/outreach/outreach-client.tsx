"use client";

// outreach-client.tsx — top-level Outreach screen.
// Renders AppShell + ScreenEyebrow + a 3-way switch (Occasions / Campaigns / Send-off).
// Each section is its own component; this file stays thin.

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ScreenEyebrow } from "@/components/screen-eyebrow";
import { OccasionsView } from "@/app/outreach/occasions-view";
import { CampaignsView } from "@/app/outreach/campaigns-view";
import { SendoffView } from "@/app/outreach/sendoff-view";
import { ListView } from "@/app/outreach/list-view";
import type { BucketCounts, Occasion } from "@/lib/outreach/types";

type Tab = "occasions" | "campaigns" | "list" | "sendoff";

interface Props {
  initialBucketCounts: BucketCounts;
  initialOccasions: Occasion[];
}

export function OutreachClient({ initialBucketCounts, initialOccasions }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("occasions");
  const [bucketCounts, setBucketCounts] = useState(initialBucketCounts);

  return (
    <AppShell>
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "24px 20px 0",
          width: "100%",
        }}
      >
        <ScreenEyebrow label="OUTREACH" title="Outreach" />

        {/* 3-way tab switch */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid var(--border)",
            marginBottom: 24,
          }}
        >
          {(
            [
              { key: "occasions", label: "Occasions" },
              { key: "campaigns", label: "Campaigns" },
              { key: "list",      label: "Email List" },
              { key: "sendoff",   label: "Send-off" },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 18px 10px",
                fontSize: 14,
                fontWeight: activeTab === key ? 700 : 400,
                color: activeTab === key ? "var(--text-primary)" : "var(--text-dim)",
                borderBottom:
                  activeTab === key
                    ? "2px solid var(--gold)"
                    : "2px solid transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Section views */}
        {activeTab === "occasions" && (
          <OccasionsView occasions={initialOccasions} />
        )}
        {activeTab === "campaigns" && (
          <CampaignsView
            bucketCounts={bucketCounts}
            onIngestComplete={(counts) => setBucketCounts(counts)}
            onRunComplete={() => {
              // Nudge user to check Send-off (no auto-nav — they may be mid-batch).
            }}
          />
        )}
        {activeTab === "list" && <ListView />}
        {activeTab === "sendoff" && <SendoffView />}
      </div>
    </AppShell>
  );
}
