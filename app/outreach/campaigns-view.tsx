"use client";

// campaigns-view.tsx — CSV upload control + two bucket cards.
// "Run" button per card is inert this chunk (generation comes next).

import { UploadCsv } from "@/app/outreach/upload-csv";
import type { BucketCounts } from "@/lib/outreach/types";

interface Props {
  bucketCounts: BucketCounts;
  onIngestComplete: (counts: BucketCounts) => void;
}

export function CampaignsView({ bucketCounts, onIngestComplete }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* CSV upload section */}
      <section>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
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

      {/* Bucket cards */}
      <section>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Guest buckets
        </h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <BucketCard
            label="Personalized"
            description="Guests with notes, tags, or preferences on file. Emails will be crafted using their details."
            count={bucketCounts.personalized}
          />
          <BucketCard
            label="Standard"
            description="Guests without free-text notes. Emails use the general venue story and occasion angle."
            count={bucketCounts.standard}
          />
        </div>

        {bucketCounts.total === 0 && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "var(--text-dim)",
            }}
          >
            No opted-in guests yet. Upload a CSV above to populate these buckets.
          </p>
        )}
      </section>
    </div>
  );
}

// ── Bucket card ───────────────────────────────────────────────────────────────

interface BucketCardProps {
  label: string;
  description: string;
  count: number;
}

function BucketCard({ label, description, count }: BucketCardProps) {
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--gold)",
            lineHeight: 1,
          }}
        >
          {count.toLocaleString()}
        </span>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
        {description}
      </p>

      {/* Run button — inert this chunk */}
      <button
        disabled
        title="Email generation coming in the next release"
        style={{
          marginTop: 4,
          padding: "7px 14px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface-hi)",
          color: "var(--text-dim)",
          fontSize: 13,
          cursor: "not-allowed",
          alignSelf: "flex-start",
        }}
      >
        Run — coming next
      </button>
    </div>
  );
}
