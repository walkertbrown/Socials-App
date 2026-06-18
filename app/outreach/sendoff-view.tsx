"use client";

// sendoff-view.tsx — gallery of generated email drafts.
// Each card is editable (subject, body) with an Approve control.
// Phase 1 ends at approved — there is NO send button.

import { useState, useEffect } from "react";
import { EmailCard } from "@/app/outreach/email-card";
import type { DraftWithGuest } from "@/lib/db/outreach-drafts";

export function SendoffView() {
  const [drafts, setDrafts]   = useState<DraftWithGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Load drafts on mount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/outreach/drafts")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<DraftWithGuest[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setDrafts(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  function handleUpdated(updated: DraftWithGuest) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
    );
  }

  if (loading) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: 14, padding: "32px 0" }}>
        Loading drafts…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: "var(--red, #f87171)", fontSize: 14, padding: "32px 0" }}>
        Could not load drafts: {error}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div
        style={{
          padding:        "48px 0",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          gap:            8,
          color:          "var(--text-dim)",
          textAlign:      "center",
        }}
      >
        <span style={{ fontSize: 32 }}>✉️</span>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>
          No drafts yet
        </p>
        <p style={{ fontSize: 13, maxWidth: 320 }}>
          Run a campaign in the Campaigns tab — or click Draft on an occasion — to
          generate emails that appear here for review.
        </p>
      </div>
    );
  }

  const approvedCount = drafts.filter((d) => d.status === "approved").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          flexWrap:       "wrap",
          gap:            8,
        }}
      >
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          {drafts.length} draft{drafts.length !== 1 ? "s" : ""} —{" "}
          {approvedCount} approved
        </p>
      </div>

      {drafts.map((draft) => (
        <EmailCard key={draft.id} draft={draft} onUpdated={handleUpdated} />
      ))}
    </div>
  );
}
