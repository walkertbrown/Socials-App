// extract-facts.ts — derives a structured fact-set from a guest row.
// The fact-set is the only data the LLM or template engine may see.
// Spend dollar amounts are converted to a tier label here so they never
// appear in any email or UI output downstream.

import type { GuestRecord, OccasionType } from "./types";

// Spend tiers (internal only — dollar amounts never leave this file).
export type SpendTier = "regular" | "notable" | "vip";

export type RecencyBucket =
  | "within_30_days"
  | "within_90_days"
  | "within_6_months"
  | "within_1_year"
  | "lapsed_1_2_years"
  | "lapsed_2_plus_years"
  | "never_tracked";

export type VisitCountTier = "first_visit" | "occasional" | "regular" | "loyal";
export type TenureTier = "new" | "returning" | "longtime"; // <1y | 1-3y | 3y+

export interface GuestFactSet {
  guest_id: string;
  first_name: string | null;
  recency: RecencyBucket;
  visit_count_tier: VisitCountTier;
  visit_count: number | null;
  tenure: TenureTier;
  years_since_first: number | null;
  spend_tier: SpendTier;
  occasion: OccasionType | null;
  notes: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

function recencyBucket(recentVisit: string | null): RecencyBucket {
  if (!recentVisit) return "never_tracked";
  const today = todayUtc();
  const days = daysBetween(recentVisit, today);
  if (days <= 30)  return "within_30_days";
  if (days <= 90)  return "within_90_days";
  if (days <= 180) return "within_6_months";
  if (days <= 365) return "within_1_year";
  if (days <= 730) return "lapsed_1_2_years";
  return "lapsed_2_plus_years";
}

function visitCountTier(visits: number | null): VisitCountTier {
  if (!visits || visits <= 1) return "first_visit";
  if (visits <= 4)  return "occasional";
  if (visits <= 12) return "regular";
  return "loyal";
}

function tenureTier(firstVisit: string | null): {
  tier: TenureTier;
  years: number | null;
} {
  if (!firstVisit) return { tier: "new", years: null };
  const today = todayUtc();
  const years = daysBetween(firstVisit, today) / 365;
  if (years < 1)  return { tier: "new",       years: Math.round(years * 10) / 10 };
  if (years < 3)  return { tier: "returning", years: Math.round(years * 10) / 10 };
  return             { tier: "longtime",  years: Math.round(years * 10) / 10 };
}

function spendTier(spend: number | null): SpendTier {
  if (!spend || spend < 500)   return "regular";
  if (spend < 2000)            return "notable";
  return                              "vip";
}

function firstNameFrom(guestName: string | null): string | null {
  if (!guestName) return null;
  const parts = guestName.trim().split(/\s+/);
  return parts[0] || null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function extractFacts(
  guest: GuestRecord,
  occasion: OccasionType | null = null
): GuestFactSet {
  const { tier: tenure, years: yearsSinceFirst } = tenureTier(guest.first_visit_date);

  return {
    guest_id:        guest.id,
    first_name:      firstNameFrom(guest.guest_name),
    recency:         recencyBucket(guest.recent_visit_date),
    visit_count_tier: visitCountTier(guest.completed_visits),
    visit_count:     guest.completed_visits,
    tenure,
    years_since_first: yearsSinceFirst,
    spend_tier:      spendTier(guest.lifetime_spend),
    occasion,
    notes:           guest.notes ?? null,
  };
}
