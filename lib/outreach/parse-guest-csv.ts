// parse-guest-csv.ts — browser-side CSV parser for GuestCenter exports.
// Does NOT run on the server; imported only by the upload-csv UI component.
//
// Why hand-rolled: papaparse is not a project dependency and this export
// is structured enough that a simple parser handles it reliably.
//
// GuestCenter column headers (the ones we care about):
//   Guest Name, Email, Marketing Opt-In, Birthday, Anniversary,
//   First Visit Date, Recent Visit Date, Completed Visits, Lifetime Spend,
//   Guest Tags, General Notes, Special Relationship,
//   Seating Preferences, Food & Drink Preferences

import type { RawGuestRow } from "./types";

// Maps GuestCenter header text → our internal key.
const HEADER_MAP: Record<string, keyof RawGuestRow> = {
  "guest name":                  "guest_name",
  "email":                       "email",
  "marketing opt-in":            "marketing_opt_in",
  "birthday":                    "birthday",
  "anniversary":                 "anniversary",
  "first visit date":            "first_visit_date",
  "recent visit date":           "recent_visit_date",
  "completed visits":            "completed_visits",
  "lifetime spend":              "lifetime_spend",
  "guest tags":                  "guest_tags",
  "general notes":               "general_notes",
  "special relationship":        "special_relationship",
  "seating preferences":         "seating_preferences",
  "food & drink preferences":    "food_and_drink_preferences",
  "food and drink preferences":  "food_and_drink_preferences",
};

// Minimal CSV line splitter that handles quoted fields (including embedded commas).
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside a quoted field.
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

// Parse a GuestCenter CSV string into raw rows.
// Returns only rows that have a non-empty email field.
export function parseGuestCsv(csvText: string): RawGuestRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  // Build a column-index → internal-key map from the header row.
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const colMap: Record<number, keyof RawGuestRow> = {};
  headers.forEach((h, i) => {
    const key = HEADER_MAP[h];
    if (key) colMap[i] = key;
  });

  const rows: RawGuestRow[] = [];

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const fields = splitCsvLine(lines[lineIdx]);
    const row: Partial<RawGuestRow> = {
      guest_name:               "",
      email:                    "",
      marketing_opt_in:         "",
      birthday:                 "",
      anniversary:              "",
      first_visit_date:         "",
      recent_visit_date:        "",
      completed_visits:         "",
      lifetime_spend:           "",
      guest_tags:               "",
      general_notes:            "",
      special_relationship:     "",
      seating_preferences:      "",
      food_and_drink_preferences: "",
    };

    fields.forEach((val, i) => {
      const key = colMap[i];
      if (key) row[key] = val;
    });

    if (row.email?.trim()) {
      rows.push(row as RawGuestRow);
    }
  }

  return rows;
}
