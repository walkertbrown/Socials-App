// Shared types for the outreach engine.
// Imported by DB modules, parse helpers, API routes, and UI components.

export type Bucket = "personalized" | "standard";

export type OccasionType = "birthday" | "anniversary" | "first_visit_anniversary";

// A row from the guests table (DB shape).
export interface GuestRecord {
  id: string;
  email: string;
  guest_name: string | null;
  marketing_opt_in: boolean;
  birthday: string | null;           // ISO date string (YYYY-MM-DD) or null
  anniversary: string | null;
  first_visit_date: string | null;
  recent_visit_date: string | null;
  completed_visits: number | null;
  lifetime_spend: number | null;
  notes: string | null;
  segment: string | null;
  bucket: Bucket;
  email_verify_status: string | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// A single upcoming occasion for the occasions calendar.
export interface Occasion {
  guest_id: string;
  guest_name: string | null;
  email: string;
  type: OccasionType;
  // The actual upcoming date this calendar year (e.g. "2026-08-15").
  date_this_year: string;
  days_away: number;
}

// A draft email in the outreach_drafts table.
export interface OutreachDraft {
  id: string;
  guest_id: string;
  occasion_type: string | null;
  angle: string | null;
  subject: string;
  body: string;
  status: string;
  personalized_from: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Per-bucket counts returned by the ingest API and the DB helper.
export interface BucketCounts {
  personalized: number;
  standard: number;
  total: number;
}

// A single raw row extracted from the GuestCenter CSV (before normalization).
// Keys match the GuestCenter column headers (snake_cased by the parser).
export interface RawGuestRow {
  guest_name: string;
  email: string;
  marketing_opt_in: string;
  birthday: string;
  anniversary: string;
  first_visit_date: string;
  recent_visit_date: string;
  completed_visits: string;
  lifetime_spend: string;
  guest_tags: string;
  general_notes: string;
  special_relationship: string;
  seating_preferences: string;
  food_and_drink_preferences: string;
}

// A normalized row ready for upsert.
export interface NormalizedGuest {
  email: string;
  guest_name: string | null;
  marketing_opt_in: boolean;
  birthday: string | null;
  anniversary: string | null;
  first_visit_date: string | null;
  recent_visit_date: string | null;
  completed_visits: number | null;
  lifetime_spend: number | null;
  notes: string | null;
  bucket: Bucket;
  segment: string | null;
}
