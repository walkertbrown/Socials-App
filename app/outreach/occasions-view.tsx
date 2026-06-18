"use client";

// occasions-view.tsx — renders the rest-of-year occasion list.
// Each row shows: emoji, guest name, occasion type, date, days-away.
// "Draft" button: verifies the guest, then generates a draft. Sequential, one at a time.

import { useState } from "react";
import type { Occasion, OccasionType } from "@/lib/outreach/types";

const TYPE_LABELS: Record<OccasionType, { emoji: string; label: string }> = {
  birthday:               { emoji: "🎂", label: "Birthday" },
  anniversary:            { emoji: "💍", label: "Anniversary" },
  first_visit_anniversary: { emoji: "🥂", label: "Visit anniversary" },
};

// Format YYYY-MM-DD as "Aug 15"
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function daysLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `${days}d away`;
}

interface Props {
  occasions: Occasion[];
}

type OccRowState = "idle" | "verifying" | "generating" | "done" | "skipped" | "error";

interface OccasionRowProps {
  occ: Occasion;
}

function OccasionRow({ occ }: OccasionRowProps) {
  const [state, setState]   = useState<OccRowState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleDraft() {
    setState("verifying");
    setMessage(null);

    // Step 1: verify email.
    let verStatus: string;
    try {
      const res = await fetch("/api/outreach/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ guest_id: occ.guest_id }),
      });
      const json = await res.json() as { status: string; quota_exhausted?: boolean; message?: string };
      if (json.quota_exhausted) {
        setMessage(json.message ?? "Email-verification limit reached.");
        setState("error");
        return;
      }
      verStatus = json.status;
    } catch (e) {
      setMessage((e as Error).message);
      setState("error");
      return;
    }

    // Skip if invalid.
    if (verStatus === "invalid") {
      setMessage("Email invalid — skipping");
      setState("skipped");
      return;
    }

    // Step 2: generate draft.
    setState("generating");
    try {
      const res = await fetch("/api/outreach/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ guest_id: occ.guest_id, occasion_type: occ.type }),
      });
      const json = await res.json() as { status: string; reason?: string };
      if (json.status === "skipped") {
        setMessage(`Skipped — ${json.reason ?? "already has draft"}`);
        setState("skipped");
      } else {
        setState("done");
        setMessage("Draft created — see Send-off");
      }
    } catch (e) {
      setMessage((e as Error).message);
      setState("error");
    }
  }

  const meta = TYPE_LABELS[occ.type];

  return (
    <div
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        background:   "var(--surface)",
        border:       "1px solid var(--border)",
        borderRadius: 8,
        padding:      "12px 14px",
        flexWrap:     "wrap",
      }}
    >
      {/* Occasion icon */}
      <span style={{ fontSize: 20, flexShrink: 0 }}>{meta.emoji}</span>

      {/* Guest + occasion info */}
      <div style={{ flex: 1, minWidth: 120 }}>
        <div
          style={{
            fontWeight:   600,
            fontSize:     14,
            color:        "var(--text-primary)",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
          }}
        >
          {occ.guest_name ?? occ.email}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>
          {meta.label} · {formatDate(occ.date_this_year)}
        </div>
      </div>

      {/* Days-away badge */}
      <span
        style={{
          fontSize:   11,
          fontWeight: 600,
          color:      occ.days_away <= 7 ? "var(--gold)" : "var(--text-dim)",
          background: occ.days_away <= 7 ? "var(--gold-dim)" : "var(--surface-hi)",
          borderRadius: 6,
          padding:    "3px 8px",
          flexShrink: 0,
        }}
      >
        {daysLabel(occ.days_away)}
      </span>

      {/* Status message (done / skipped / error) */}
      {message && (
        <span
          style={{
            fontSize:   11,
            color:
              state === "error"   ? "var(--red, #f87171)" :
              state === "skipped" ? "var(--text-dim)" :
              "var(--gold)",
          }}
        >
          {message}
        </span>
      )}

      {/* Draft button */}
      <button
        onClick={handleDraft}
        disabled={state !== "idle"}
        style={{
          fontSize:     12,
          padding:      "5px 12px",
          border:       state === "done"
            ? "1px solid var(--gold)"
            : "1px solid var(--border-hi)",
          borderRadius: 6,
          background:   state === "done" ? "var(--gold-dim, rgba(212,175,55,0.12))" : "var(--surface-hi)",
          color:        state === "done" ? "var(--gold)" :
                        state !== "idle" ? "var(--text-dim)" : "var(--text-primary)",
          cursor:       state === "idle" ? "pointer" : "not-allowed",
          flexShrink:   0,
        }}
      >
        {state === "idle"       ? "Draft" :
         state === "verifying"  ? "Verifying…" :
         state === "generating" ? "Generating…" :
         state === "done"       ? "Drafted" :
         state === "skipped"    ? "Skipped" :
                                  "Error"}
      </button>
    </div>
  );
}

export function OccasionsView({ occasions }: Props) {
  if (occasions.length === 0) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: 14, padding: "24px 0" }}>
        No upcoming occasions for the rest of this year. Upload a guest list in Campaigns to
        populate this calendar.
      </div>
    );
  }

  return (
    <div>
      <p
        style={{
          fontSize:      13,
          color:         "var(--text-secondary)",
          marginBottom:  16,
        }}
      >
        {occasions.length} occasion{occasions.length !== 1 ? "s" : ""} remaining this year — sorted by date.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {occasions.map((occ) => (
          <OccasionRow key={`${occ.guest_id}-${occ.type}`} occ={occ} />
        ))}
      </div>
    </div>
  );
}
