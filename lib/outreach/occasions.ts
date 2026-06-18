// occasions.ts — derives upcoming occasions for the rest of the current calendar year.
//
// Three occasion types per guest (if the relevant date field is populated):
//   birthday            — month/day of Birthday
//   anniversary         — month/day of Anniversary
//   first_visit_anniversary — month/day of First Visit Date
//
// "Rest of year" = dates whose month/day fall between today (inclusive) and Dec 31
// of the current year. We compare month+day only, projecting each date into the
// current year, so a guest born on 2000-08-15 gets an entry for 2026-08-15.

import type { GuestRecord, Occasion, OccasionType } from "./types";

// Returns today's date in YYYY-MM-DD (UTC). We use UTC throughout to avoid
// timezone drift when comparing dates stored as plain DATE in Postgres.
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// Parse a stored date string (YYYY-MM-DD) to { month, day } — 1-indexed.
function monthDay(dateStr: string): { month: number; day: number } | null {
  const parts = dateStr.split("-");
  if (parts.length < 3) return null;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day)) return null;
  return { month, day };
}

// Build the projected date for this calendar year (e.g. "2026-08-15").
function projectToThisYear(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Number of days between today and a future date string (both YYYY-MM-DD).
function daysAway(today: string, future: string): number {
  const t = new Date(today);
  const f = new Date(future);
  return Math.round((f.getTime() - t.getTime()) / 86_400_000);
}

// Check if a projected date (this year) falls between today and Dec 31 inclusive.
function isInRestOfYear(today: string, projected: string): boolean {
  return projected >= today && projected <= today.slice(0, 4) + "-12-31";
}

// Derive all upcoming occasions for a single guest.
function occasionsForGuest(guest: GuestRecord, today: string, year: number): Occasion[] {
  const occasions: Occasion[] = [];

  const sources: Array<{ field: string | null; type: OccasionType }> = [
    { field: guest.birthday,         type: "birthday" },
    { field: guest.anniversary,      type: "anniversary" },
    { field: guest.first_visit_date, type: "first_visit_anniversary" },
  ];

  for (const { field, type } of sources) {
    if (!field) continue;
    const md = monthDay(field);
    if (!md) continue;

    const projected = projectToThisYear(year, md.month, md.day);
    if (!isInRestOfYear(today, projected)) continue;

    occasions.push({
      guest_id:       guest.id,
      guest_name:     guest.guest_name,
      email:          guest.email,
      type,
      date_this_year: projected,
      days_away:      daysAway(today, projected),
    });
  }

  return occasions;
}

// Derive all rest-of-year occasions for a list of guests, sorted by days_away.
export function deriveOccasions(guests: GuestRecord[]): Occasion[] {
  const today = todayUtc();
  const year = parseInt(today.slice(0, 4), 10);

  const all: Occasion[] = [];
  for (const guest of guests) {
    all.push(...occasionsForGuest(guest, today, year));
  }

  all.sort((a, b) => a.days_away - b.days_away);
  return all;
}

// Resolve the single soonest occasion for one guest whose next occurrence falls
// within `withinDays` of today (0 = today, inclusive). Returns its type, or null
// if none are coming up that soon.
//
// Unlike deriveOccasions (which only looks at the rest of THIS calendar year),
// this wraps across the year boundary: a birthday on Jan 3 still counts as
// "upcoming" when today is Dec 28. Used by generation to auto-acknowledge a
// near-term occasion even when the caller did not explicitly pass one — e.g. a
// Campaigns "Run" that would otherwise send a generic win-back to someone whose
// birthday is in three days.
export function upcomingOccasionType(
  guest: GuestRecord,
  withinDays = 30
): OccasionType | null {
  const today = todayUtc();
  const year = parseInt(today.slice(0, 4), 10);

  // Iterated in priority order so equidistant occasions break the tie the same
  // way pickAngle does: birthday > anniversary > first-visit anniversary.
  const sources: Array<{ field: string | null; type: OccasionType }> = [
    { field: guest.birthday,         type: "birthday" },
    { field: guest.anniversary,      type: "anniversary" },
    { field: guest.first_visit_date, type: "first_visit_anniversary" },
  ];

  let best: { type: OccasionType; days: number } | null = null;

  for (const { field, type } of sources) {
    if (!field) continue;
    const md = monthDay(field);
    if (!md) continue;

    // Project to this year; if that date already passed, roll to next year so
    // the window can straddle Dec → Jan.
    let projected = projectToThisYear(year, md.month, md.day);
    let days = daysAway(today, projected);
    if (days < 0) {
      projected = projectToThisYear(year + 1, md.month, md.day);
      days = daysAway(today, projected);
    }

    if (days < 0 || days > withinDays) continue;

    // Keep the soonest; ties keep the earlier (higher-priority) source.
    if (best === null || days < best.days) {
      best = { type, days };
    }
  }

  return best ? best.type : null;
}
