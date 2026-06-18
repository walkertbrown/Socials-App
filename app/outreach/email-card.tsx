"use client";

// email-card.tsx — a single editable draft card in the Send-off gallery.
// Shows: recipient, subject (editable), body (editable), angle + occasion chips,
// "personalized from" chip, and Approve / save-edits controls.
// Phase 1 ends at approved — there is NO send button.

import { useState } from "react";
import type { DraftWithGuest } from "@/lib/db/outreach-drafts";

interface Props {
  draft: DraftWithGuest;
  onUpdated: (updated: DraftWithGuest) => void;
}

const ANGLE_LABELS: Record<string, string> = {
  birthday:         "Birthday",
  anniversary:      "Anniversary",
  visit_anniversary: "Visit anniversary",
  service_recovery: "Service recovery",
  win_back:         "Win-back",
  thank_you:        "Thank you",
  re_engage:        "Re-engage",
};

export function EmailCard({ draft, onUpdated }: Props) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody]       = useState(draft.body);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Dirty = user has typed something different from the stored values.
  const isDirty =
    subject !== draft.subject || body !== draft.body;

  async function saveEdits() {
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/outreach/draft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, subject, body }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      onUpdated({ ...draft, ...updated });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleApprove() {
    const newApproved = draft.status !== "approved";
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/outreach/draft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, approved: newApproved }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      onUpdated({ ...draft, ...updated });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const approved = draft.status === "approved";

  return (
    <div
      style={{
        background:    "var(--surface)",
        border:        `1px solid ${approved ? "var(--gold)" : "var(--border)"}`,
        borderRadius:  10,
        padding:       20,
        display:       "flex",
        flexDirection: "column",
        gap:           14,
      }}
    >
      {/* Header row: recipient + chips */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontWeight: 600,
            fontSize:   14,
            color:      "var(--text-primary)",
            flexShrink: 0,
          }}
        >
          {draft.guest_name ?? draft.guest_email}
        </span>
        {draft.guest_name && (
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {draft.guest_email}
          </span>
        )}
        {visitInfo(draft) && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>· {visitInfo(draft)}</span>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
          {draft.angle && (
            <Chip label={ANGLE_LABELS[draft.angle] ?? draft.angle} color="var(--gold)" />
          )}
          {draft.occasion_type && (
            <Chip label={draft.occasion_type.replace(/_/g, " ")} color="var(--teal, #2dd4bf)" />
          )}
          {draft.personalized_from && (
            <Chip label="Personalized" color="var(--text-secondary)" />
          )}
          {approved && (
            <Chip label="Approved" color="var(--gold)" bold />
          )}
        </div>
      </div>

      {/* Subject */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label
          style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}
        >
          Subject
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{
            width:        "100%",
            padding:      "7px 10px",
            border:       "1px solid var(--border)",
            borderRadius: 6,
            background:   "var(--surface-hi)",
            color:        "var(--text-primary)",
            fontSize:     13,
            fontFamily:   "inherit",
            boxSizing:    "border-box",
          }}
        />
      </div>

      {/* Body */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label
          style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase" }}
        >
          Body
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          style={{
            width:        "100%",
            padding:      "7px 10px",
            border:       "1px solid var(--border)",
            borderRadius: 6,
            background:   "var(--surface-hi)",
            color:        "var(--text-primary)",
            fontSize:     13,
            fontFamily:   "inherit",
            lineHeight:   1.6,
            resize:       "vertical",
            boxSizing:    "border-box",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <p style={{ fontSize: 12, color: "var(--red, #f87171)", margin: 0 }}>
          {error}
        </p>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isDirty && (
          <button
            onClick={saveEdits}
            disabled={saving}
            style={{
              padding:      "7px 14px",
              border:       "1px solid var(--border-hi)",
              borderRadius: 6,
              background:   "var(--surface-hi)",
              color:        "var(--text-primary)",
              fontSize:     13,
              cursor:       saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save edits"}
          </button>
        )}

        <button
          onClick={toggleApprove}
          disabled={saving}
          style={{
            padding:      "7px 14px",
            border:       approved ? "1px solid var(--gold)" : "1px solid var(--border-hi)",
            borderRadius: 6,
            background:   approved ? "var(--gold-dim, rgba(212,175,55,0.12))" : "var(--surface-hi)",
            color:        approved ? "var(--gold)" : "var(--text-primary)",
            fontSize:     13,
            fontWeight:   approved ? 700 : 400,
            cursor:       saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "…" : approved ? "Approved" : "Approve"}
        </button>
      </div>
    </div>
  );
}

// "Last visit Mar 14, 2026 (3mo ago) · 7 visits" — so the reviewer can see recency.
function visitInfo(d: DraftWithGuest): string | null {
  const iso = d.recent_visit_date;
  if (!iso) return d.completed_visits ? `${d.completed_visits} visits on record` : null;
  const dt = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (isNaN(dt.getTime())) return null;
  const date = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
  const ago =
    days <= 0 ? "today" :
    days < 31 ? `${days}d ago` :
    days < 365 ? `${Math.round(days / 30)}mo ago` :
    `${(days / 365).toFixed(1)}y ago`;
  const v = d.completed_visits ? ` · ${d.completed_visits} visit${d.completed_visits === 1 ? "" : "s"}` : "";
  return `Last visit ${date} (${ago})${v}`;
}

// ── Chip ──────────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  color: string;
  bold?: boolean;
}

function Chip({ label, color, bold }: ChipProps) {
  return (
    <span
      style={{
        fontSize:     11,
        fontWeight:   bold ? 700 : 500,
        color,
        background:   "var(--surface-hi)",
        border:       `1px solid ${color}`,
        borderRadius: 20,
        padding:      "2px 8px",
      }}
    >
      {label}
    </span>
  );
}
