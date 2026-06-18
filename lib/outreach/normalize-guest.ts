// normalize-guest.ts — converts a raw GuestCenter CSV row into a clean
// NormalizedGuest ready for upsert. No I/O; pure transformation.

import type { RawGuestRow, NormalizedGuest } from "./types";
import { assignBucket } from "./segment-guests";

// GuestCenter exports dates as "YYYY-MM-DDTHH:MM:SS" (or similar ISO-ish).
// We only need the date portion (YYYY-MM-DD) for our DB date columns.
function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  // Accept "YYYY-MM-DD..." — take just the date portion.
  const match = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseOptIn(raw: string): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1" || v === "y";
}

function parseInteger(raw: string): number | null {
  if (!raw?.trim()) return null;
  const n = parseInt(raw.trim(), 10);
  return isNaN(n) ? null : n;
}

function parseDecimal(raw: string): number | null {
  if (!raw?.trim()) return null;
  // Strip currency symbols, commas.
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Concatenate the five free-text fields, skipping empties, separated by " | ".
function buildNotes(row: RawGuestRow): string | null {
  const parts = [
    row.guest_tags,
    row.general_notes,
    row.special_relationship,
    row.seating_preferences,
    row.food_and_drink_preferences,
  ]
    .map((s) => s?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : null;
}

export function normalizeGuest(raw: RawGuestRow): NormalizedGuest {
  const notes = buildNotes(raw);
  const marketing_opt_in = parseOptIn(raw.marketing_opt_in);
  const birthday = parseDate(raw.birthday);
  const anniversary = parseDate(raw.anniversary);
  const first_visit_date = parseDate(raw.first_visit_date);
  const recent_visit_date = parseDate(raw.recent_visit_date);

  return {
    email:            raw.email.trim().toLowerCase(),
    guest_name:       raw.guest_name?.trim() || null,
    marketing_opt_in,
    birthday,
    anniversary,
    first_visit_date,
    recent_visit_date,
    completed_visits: parseInteger(raw.completed_visits),
    lifetime_spend:   parseDecimal(raw.lifetime_spend),
    notes,
    bucket:           assignBucket({ notes }),
    segment:          null,   // reserved for future recency segmentation
  };
}
