"use client";

// campaigns-view.tsx — CSV upload + skip-verify toggle + two bucket cards with wired Run buttons.
// Run logic is in use-campaign-run.ts (extracted to stay under 300 lines).

import { useState } from "react";
import { UploadCsv } from "@/app/outreach/upload-csv";
import { useCampaignRun } from "@/app/outreach/use-campaign-run";
import type { BucketCounts } from "@/lib/outreach/types";

interface Props {
  bucketCounts: BucketCounts;
  onIngestComplete: (counts: BucketCounts) => void;
  onRunComplete?: () => void;
}

export function CampaignsView({ bucketCounts, onIngestComplete, onRunComplete }: Props) {
  // Default OFF — must be explicitly toggled on for testing.
  const [skipVerify, setSkipVerify] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section>
        <h2
          style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}
        >
          Import guest list
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
          Export opted-in guests from GuestCenter and upload the CSV. Only guests with
          Marketing Opt-In = Yes are imported. Re-uploading is safe — existing records
          are updated, never duplicated.
        </p>
        <UploadCsv onComplete={onIngestComplete} />
      </section>

      <section>
        <h2
          style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}
        >
          Guest buckets
        </h2>

        {/* Skip-verification toggle — testing aid, default OFF */}
        <label
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        8,
            marginBottom: 16,
            cursor:     "pointer",
            width:      "fit-content",
          }}
        >
          <input
            type="checkbox"
            checked={skipVerify}
            onChange={(e) => setSkipVerify(e.target.checked)}
            style={{ cursor: "pointer", accentColor: "var(--gold)" }}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Skip verification (for testing)
          </span>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            — generate without checking addresses, uses no verification credits
          </span>
        </label>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <BucketCard
            label="Personalized"
            description="Guests with notes, tags, or preferences on file. Emails are crafted via AI using their details."
            count={bucketCounts.personalized}
            bucket="personalized"
            skipVerify={skipVerify}
            onRunComplete={onRunComplete}
          />
          <BucketCard
            label="Standard"
            description="Guests without free-text notes. Emails use template text — zero LLM calls."
            count={bucketCounts.standard}
            bucket="standard"
            skipVerify={skipVerify}
            onRunComplete={onRunComplete}
          />
        </div>

        {bucketCounts.total === 0 && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-dim)" }}>
            No opted-in guests yet. Upload a CSV above to populate these buckets.
          </p>
        )}
      </section>
    </div>
  );
}

// ── Bucket card ───────────────────────────────────────────────────────────────

interface BucketCardProps {
  label:        string;
  description:  string;
  count:        number;
  bucket:       "personalized" | "standard";
  skipVerify:   boolean;
  onRunComplete?: () => void;
}

function BucketCard({ label, description, count, bucket, skipVerify, onRunComplete }: BucketCardProps) {
  const {
    runState, progress, error, quotaMsg, canContinue, handleRun, handleContinue,
  } = useCampaignRun(bucket, onRunComplete, skipVerify);

  const canRun = count > 0 && runState === "idle";

  return (
    <div
      style={{
        flex: "1 1 200px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
          {label}
        </span>
        <span style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>
          {count.toLocaleString()}
        </span>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{description}</p>

      {/* Progress */}
      {progress && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ProgressBar value={progress.processed} max={progress.total} />
          <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0 }}>
            {progress.processed}/{progress.total} — {progress.generated} drafted,{" "}
            {progress.skipped} skipped, {progress.failed} failed
          </p>
        </div>
      )}

      {quotaMsg && (
        <p style={{ fontSize: 12, color: "var(--gold)", margin: 0 }}>{quotaMsg}</p>
      )}
      {error && (
        <p style={{ fontSize: 12, color: "var(--red, #f87171)", margin: 0 }}>{error}</p>
      )}
      {runState === "done" && !canContinue && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          Run complete. View drafts in Send-off.
        </p>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        {runState !== "running" && (
          <button
            onClick={runState === "idle" ? handleRun : undefined}
            disabled={!canRun && runState !== "done"}
            style={{
              padding: "7px 14px",
              border: canRun ? "1px solid var(--border-hi)" : "1px solid var(--border)",
              borderRadius: 6,
              background: canRun ? "var(--surface-hi)" : "var(--surface)",
              color: canRun ? "var(--text-primary)" : "var(--text-dim)",
              fontSize: 13,
              cursor: canRun ? "pointer" : "not-allowed",
            }}
          >
            {runState === "done" ? "Re-run" : "Run"}
          </button>
        )}

        {runState === "running" && (
          <button disabled style={{ padding: "7px 14px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-dim)", fontSize: 13 }}>
            Running…
          </button>
        )}

        {canContinue && (
          <button
            onClick={handleContinue}
            style={{
              padding: "7px 14px",
              border: "1px solid var(--gold)",
              borderRadius: 6,
              background: "var(--gold-dim, rgba(212,175,55,0.12))",
              color: "var(--gold)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Generate next 100
          </button>
        )}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: "var(--surface-hi)", borderRadius: 3, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "var(--gold)",
          borderRadius: 3,
          transition: "width 0.2s",
        }}
      />
    </div>
  );
}
