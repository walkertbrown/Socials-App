"use client";

// occasions-view.tsx — renders the rest-of-year occasion list.
// Each row shows: emoji icon, guest name, occasion type, upcoming date, days-away.
// "Draft" button per row is present but inert this chunk — wired in next chunk.

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
          fontSize: 13,
          color: "var(--text-secondary)",
          marginBottom: 16,
        }}
      >
        {occasions.length} occasion{occasions.length !== 1 ? "s" : ""} remaining this year — sorted by date.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {occasions.map((occ) => {
          const meta = TYPE_LABELS[occ.type];
          return (
            <div
              key={`${occ.guest_id}-${occ.type}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              {/* Occasion icon */}
              <span style={{ fontSize: 20, flexShrink: 0 }}>{meta.emoji}</span>

              {/* Guest + occasion info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
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
                  fontSize: 11,
                  fontWeight: 600,
                  color: occ.days_away <= 7 ? "var(--gold)" : "var(--text-dim)",
                  background:
                    occ.days_away <= 7 ? "var(--gold-dim)" : "var(--surface-hi)",
                  borderRadius: 6,
                  padding: "3px 8px",
                  flexShrink: 0,
                }}
              >
                {daysLabel(occ.days_away)}
              </span>

              {/* Draft button — inert this chunk */}
              <button
                disabled
                title="Email drafting coming in the next release"
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--surface-hi)",
                  color: "var(--text-dim)",
                  cursor: "not-allowed",
                  flexShrink: 0,
                }}
              >
                Draft
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
