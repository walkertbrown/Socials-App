"use client";

// sendoff-view.tsx — placeholder for the generated-email gallery.
// Built in the next chunk once the generation pipeline exists.

export function SendoffView() {
  return (
    <div
      style={{
        padding: "40px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        color: "var(--text-dim)",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 32 }}>✉️</span>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>
        Generated emails will appear here
      </p>
      <p style={{ fontSize: 13, maxWidth: 320 }}>
        Approve a campaign run in Campaigns to generate and review personalized drafts
        before they send.
      </p>
    </div>
  );
}
