"use client";

// guest-row.tsx — one row in the Email List roster + its display helpers.
// Extracted from list-view.tsx to keep that file under the ~300-line ceiling.

import type { GuestRecord } from "@/lib/outreach/types";

const VERIFY_LABELS: Record<string, string> = {
  valid:          "valid",
  invalid:        "invalid",
  catchall:       "catchall",
  unknown:        "unknown",
  not_configured: "pending",
};

const VERIFY_COLORS: Record<string, string> = {
  valid:          "var(--teal, #2dd4bf)",
  invalid:        "var(--red, #f87171)",
  catchall:       "var(--gold)",
  unknown:        "var(--text-dim)",
  not_configured: "var(--text-dim)",
};

function verifyLabel(status: string | null): string {
  if (status === null) return "not checked";
  return VERIFY_LABELS[status] ?? status;
}

function verifyColor(status: string | null): string {
  if (status === null) return "var(--border-hi)";
  return VERIFY_COLORS[status] ?? "var(--text-dim)";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function GuestRow({ guest: g }: { guest: GuestRecord }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
        padding: "10px 12px", background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 8, fontSize: 13,
      }}
    >
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <span style={{ fontWeight: 600, color: "var(--text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {g.guest_name ?? "(no name)"}
        </span>
        <span style={{ color: "var(--text-dim)", fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {g.email}
        </span>
      </div>

      <Chip
        label={g.bucket === "personalized" ? "Personalized" : "Standard"}
        color={g.bucket === "personalized" ? "var(--teal, #2dd4bf)" : "var(--text-secondary)"}
      />
      <Chip label={verifyLabel(g.email_verify_status)} color={verifyColor(g.email_verify_status)} />

      <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: "auto", whiteSpace: "nowrap" }}>
        {g.recent_visit_date ? formatDate(g.recent_visit_date) : "no visit date"}
        {g.completed_visits ? ` · ${g.completed_visits} visits` : ""}
      </span>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 500, color,
        background: "var(--surface-hi)", border: `1px solid ${color}`,
        borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
