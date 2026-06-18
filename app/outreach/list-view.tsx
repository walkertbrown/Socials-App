"use client";

// list-view.tsx — saved guest roster ("Email List" tab).
// Read-only in v1: shows total counts, verify-status summary, and a
// searchable table capped at 150 rendered rows. Fetches from
// GET /api/outreach/guests on mount, same pattern as sendoff-view.tsx.

import { useState, useEffect, useMemo } from "react";
import type { GuestRecord } from "@/lib/outreach/types";

// ── Verify status display helpers ─────────────────────────────────────────────

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

// ── Date formatting ───────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// ── Row render cap ────────────────────────────────────────────────────────────

const ROW_CAP = 150;

// ── Component ─────────────────────────────────────────────────────────────────

export function ListView() {
  const [guests, setGuests]   = useState<GuestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [query, setQuery]     = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/outreach/guests")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<GuestRecord[]>;
      })
      .then((data) => {
        if (!cancelled) { setGuests(data); setLoading(false); }
      })
      .catch((e) => {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  // Summary counts — derived from the full list, not the filtered/capped view.
  const totalGuests    = guests.length;
  const verifiedValid  = guests.filter((g) => g.email_verify_status === "valid").length;
  const personalized   = guests.filter((g) => g.bucket === "personalized").length;
  const standard       = guests.filter((g) => g.bucket === "standard").length;

  // Filter by query (name or email, case-insensitive).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        (g.guest_name ?? "").toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q)
    );
  }, [guests, query]);

  const displayed  = filtered.slice(0, ROW_CAP);
  const isCapped   = filtered.length > ROW_CAP;

  // ── Loading / error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: 14, padding: "32px 0" }}>
        Loading guest list…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: "var(--red, #f87171)", fontSize: 14, padding: "32px 0" }}>
        Could not load guests: {error}
      </div>
    );
  }

  // ── Main view ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Saved-roster header */}
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        Your guest list is saved here. You only upload to add or refresh guests,
        never to re-run campaigns.
      </p>

      {/* Summary counts */}
      {totalGuests > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <SummaryChip label="Total guests"      value={totalGuests} />
          <SummaryChip label="Verified valid"    value={verifiedValid} />
          <SummaryChip label="Personalized"      value={personalized} />
          <SummaryChip label="Standard"          value={standard} />
        </div>
      )}

      {/* Empty state */}
      {totalGuests === 0 && (
        <div
          style={{
            padding:       "48px 0",
            textAlign:     "center",
            color:         "var(--text-dim)",
            fontSize:      14,
          }}
        >
          No opted-in guests yet. Upload a CSV in the Campaigns tab to populate this list.
        </div>
      )}

      {/* Search input */}
      {totalGuests > 0 && (
        <input
          type="search"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width:        "100%",
            padding:      "8px 12px",
            border:       "1px solid var(--border)",
            borderRadius: 6,
            background:   "var(--surface-hi)",
            color:        "var(--text-primary)",
            fontSize:     13,
            fontFamily:   "inherit",
            boxSizing:    "border-box",
          }}
        />
      )}

      {/* Row cap note */}
      {isCapped && (
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
          Showing {ROW_CAP} of {filtered.length.toLocaleString()} — search to narrow
        </p>
      )}

      {/* Guest table */}
      {displayed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {displayed.map((g) => (
            <GuestRow key={g.id} guest={g} />
          ))}
        </div>
      )}

      {/* No results after filtering */}
      {totalGuests > 0 && filtered.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
          No guests match "{query}".
        </p>
      )}
    </div>
  );
}

// ── Guest row ─────────────────────────────────────────────────────────────────

function GuestRow({ guest: g }: { guest: GuestRecord }) {
  return (
    <div
      style={{
        display:        "flex",
        alignItems:     "center",
        flexWrap:       "wrap",
        gap:            8,
        padding:        "10px 12px",
        background:     "var(--surface)",
        border:         "1px solid var(--border)",
        borderRadius:   8,
        fontSize:       13,
      }}
    >
      {/* Name + email */}
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <span
          style={{
            fontWeight:   600,
            color:        "var(--text-primary)",
            display:      "block",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
          }}
        >
          {g.guest_name ?? "(no name)"}
        </span>
        <span
          style={{
            color:        "var(--text-dim)",
            fontSize:     12,
            display:      "block",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
          }}
        >
          {g.email}
        </span>
      </div>

      {/* Bucket chip */}
      <Chip
        label={g.bucket === "personalized" ? "Personalized" : "Standard"}
        color={g.bucket === "personalized" ? "var(--teal, #2dd4bf)" : "var(--text-secondary)"}
      />

      {/* Verify status chip */}
      <Chip
        label={verifyLabel(g.email_verify_status)}
        color={verifyColor(g.email_verify_status)}
      />

      {/* Visit info */}
      <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: "auto", whiteSpace: "nowrap" }}>
        {g.recent_visit_date ? formatDate(g.recent_visit_date) : "no visit date"}
        {g.completed_visits ? ` · ${g.completed_visits} visits` : ""}
      </span>
    </div>
  );
}

// ── Summary chip ──────────────────────────────────────────────────────────────

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding:      "8px 14px",
        background:   "var(--surface)",
        border:       "1px solid var(--border)",
        borderRadius: 8,
        display:      "flex",
        flexDirection: "column",
        alignItems:   "center",
        gap:          2,
        minWidth:     80,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
        {label}
      </span>
    </div>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize:     11,
        fontWeight:   500,
        color,
        background:   "var(--surface-hi)",
        border:       `1px solid ${color}`,
        borderRadius: 20,
        padding:      "2px 8px",
        whiteSpace:   "nowrap",
      }}
    >
      {label}
    </span>
  );
}
