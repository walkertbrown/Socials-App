"use client";

// list-view.tsx — saved guest roster ("Email List" tab).
// Read-only in v1: total counts, a verify summary, and a searchable table
// capped at 150 rendered rows. Fetches GET /api/outreach/guests on mount,
// same pattern as sendoff-view.tsx. Row + chips live in guest-row.tsx.

import { useState, useEffect, useMemo } from "react";
import type { GuestRecord } from "@/lib/outreach/types";
import { GuestRow } from "./guest-row";

const ROW_CAP = 150;

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

  // Summary counts — from the full list, not the filtered/capped view.
  const totalGuests   = guests.length;
  const verifiedValid = guests.filter((g) => g.email_verify_status === "valid").length;
  const personalized  = guests.filter((g) => g.bucket === "personalized").length;
  const standard      = guests.filter((g) => g.bucket === "standard").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        (g.guest_name ?? "").toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q)
    );
  }, [guests, query]);

  const displayed = filtered.slice(0, ROW_CAP);
  const isCapped  = filtered.length > ROW_CAP;

  if (loading) {
    return <div style={{ color: "var(--text-dim)", fontSize: 14, padding: "32px 0" }}>Loading guest list…</div>;
  }
  if (error) {
    return <div style={{ color: "var(--red, #f87171)", fontSize: 14, padding: "32px 0" }}>Could not load guests: {error}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        Your guest list is saved here. You only upload to add or refresh guests, never to re-run campaigns.
      </p>

      {totalGuests > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <SummaryChip label="Total guests"   value={totalGuests} />
          <SummaryChip label="Verified valid" value={verifiedValid} />
          <SummaryChip label="Personalized"   value={personalized} />
          <SummaryChip label="Standard"       value={standard} />
        </div>
      )}

      {totalGuests === 0 && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 14 }}>
          No opted-in guests yet. Upload a CSV in the Campaigns tab to populate this list.
        </div>
      )}

      {totalGuests > 0 && (
        <input
          type="search"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%", padding: "8px 12px", border: "1px solid var(--border)",
            borderRadius: 6, background: "var(--surface-hi)", color: "var(--text-primary)",
            fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
      )}

      {isCapped && (
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
          Showing {ROW_CAP} of {filtered.length.toLocaleString()} — search to narrow
        </p>
      )}

      {displayed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {displayed.map((g) => <GuestRow key={g.id} guest={g} />)}
        </div>
      )}

      {totalGuests > 0 && filtered.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No guests match &quot;{query}&quot;.</p>
      )}
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: "8px 14px", background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center",
        gap: 2, minWidth: 80,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)", lineHeight: 1 }}>
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>{label}</span>
    </div>
  );
}
