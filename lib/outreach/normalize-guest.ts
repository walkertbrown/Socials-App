// normalize-guest.ts — converts a raw GuestCenter CSV row into a clean
// NormalizedGuest ready for upsert. No I/O; pure transformation.

import type { RawGuestRow, NormalizedGuest } from "./types";
import { assignBucket } from "./segment-guests";

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

// GuestCenter stores dates in TWO shapes:
//  • visit dates → ISO-ish "YYYY-MM-DDTHH:MM:SS" — take the date portion.
//  • birthday / anniversary → "Mmm D" / "Mmm DD" (month name + day, NO year).
//    We store these with a sentinel leap year (2000) so Feb 29 is valid; only the
//    month+day is ever used — the Occasions view projects them onto the current year.
function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const md = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2})$/); // "Dec 30", "Jan 11"
  if (md) {
    const mm = MONTHS[md[1].slice(0, 3).toLowerCase()];
    if (mm) return `2000-${mm}-${md[2].padStart(2, "0")}`;
  }
  return null;
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
