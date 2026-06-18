import "server-only";
// guests.ts — all reads and writes for the guests table.
// Uses the service-role admin client (same pattern as dm-threads.ts).
// If the guests table does not yet exist (migration not applied), reads degrade
// gracefully to empty results rather than throwing.

import { createAdminClient } from "@/lib/supabase/admin";
import { deriveOccasions } from "@/lib/outreach/occasions";
import type { GuestRecord, NormalizedGuest, BucketCounts, Occasion } from "@/lib/outreach/types";

// Upsert a batch of normalized guests on their email (natural key).
// Idempotent: re-uploading the same CSV never creates duplicates.
// updated_at is refreshed on every upsert so callers can see when data changed.
export async function upsertGuests(rows: NormalizedGuest[]): Promise<void> {
  if (rows.length === 0) return;
  const sb = createAdminClient();

  const records = rows.map((r) => ({
    email:            r.email,
    guest_name:       r.guest_name,
    marketing_opt_in: r.marketing_opt_in,
    birthday:         r.birthday,
    anniversary:      r.anniversary,
    first_visit_date: r.first_visit_date,
    recent_visit_date: r.recent_visit_date,
    completed_visits: r.completed_visits,
    lifetime_spend:   r.lifetime_spend,
    notes:            r.notes,
    bucket:           r.bucket,
    segment:          r.segment,
    updated_at:       new Date().toISOString(),
  }));

  const { error } = await sb
    .from("guests")
    .upsert(records, { onConflict: "email" });
  if (error) {
    // Table absent (migration 0016 not applied) → clean, actionable message.
    if (error.code === "42P01") {
      throw new Error("Outreach tables not created yet — apply migration 0016_outreach.sql.");
    }
    throw error;
  }
}

// Per-bucket counts. Degrades to zero counts if the table is absent.
export async function getGuestBucketCounts(): Promise<BucketCounts> {
  const sb = createAdminClient();

  try {
    const { data, error } = await sb
      .from("guests")
      .select("bucket")
      .eq("marketing_opt_in", true);

    if (error) {
      // Table not yet created — return empty counts.
      if (error.code === "42P01") return { personalized: 0, standard: 0, total: 0 };
      throw new Error(error.message);
    }

    const rows = data ?? [];
    const personalized = rows.filter((r) => r.bucket === "personalized").length;
    const standard = rows.filter((r) => r.bucket === "standard").length;
    return { personalized, standard, total: personalized + standard };
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes("42P01")) {
      return { personalized: 0, standard: 0, total: 0 };
    }
    throw err;
  }
}

// Fetch all opted-in guests in a specific bucket.
// Degrades to empty array if the table is absent.
export async function getGuestsByBucket(bucket: "personalized" | "standard"): Promise<GuestRecord[]> {
  const sb = createAdminClient();

  try {
    const { data, error } = await sb
      .from("guests")
      .select("*")
      .eq("marketing_opt_in", true)
      .eq("bucket", bucket)
      .order("guest_name", { ascending: true });

    if (error) {
      if (error.code === "42P01") return [];
      throw new Error(error.message);
    }

    return (data ?? []) as GuestRecord[];
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes("42P01")) return [];
    throw err;
  }
}

// Set the NeverBounce verification status on a guest.
// email_verified_at is always updated to now() so the verify-once cache can
// compare freshness on subsequent calls.
export async function setVerifyStatus(
  guestId: string,
  status: string
): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from("guests")
    .update({
      email_verify_status: status,
      email_verified_at:   new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    })
    .eq("id", guestId);

  if (error) {
    if (error.code === "42P01") return; // migration not applied — skip silently
    throw new Error(error.message);
  }
}

// Reset every guest's verification status (part of "clear & start over" so a
// re-run verifies fresh). No-op if the table is absent.
export async function resetVerifyStatuses(): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from("guests")
    .update({ email_verify_status: null, email_verified_at: null })
    .gte("created_at", "2000-01-01"); // matches every row
  if (error && error.code !== "42P01") throw new Error(error.message);
}

// Fetch opted-in guests in a bucket that are ready for a generation run.
// "Needs work" = valid verify status (or unverified, so the verify step can run)
// and no existing draft. Used by the Run loop to build the work queue.
// limit caps the batch at 100 (per the plan spec).
export async function getGuestsForRun(
  bucket: "personalized" | "standard",
  limit = 100
): Promise<GuestRecord[]> {
  const sb = createAdminClient();
  try {
    const { data, error } = await sb
      .from("guests")
      .select("*")
      .eq("marketing_opt_in", true)
      .eq("bucket", bucket)
      .order("guest_name", { ascending: true })
      .limit(limit);

    if (error) {
      if (error.code === "42P01") return [];
      throw new Error(error.message);
    }
    return (data ?? []) as GuestRecord[];
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes("42P01")) return [];
    throw err;
  }
}

// Fetch all opted-in guests that have at least one relevant date field,
// then derive the rest-of-year occasion list.
// Degrades to empty array if the table is absent.
export async function getUpcomingOccasions(): Promise<Occasion[]> {
  const sb = createAdminClient();

  try {
    // Fetch all opted-in guests who have any date field set.
    // deriveOccasions handles the per-guest per-field logic.
    const { data, error } = await sb
      .from("guests")
      .select("*")
      .eq("marketing_opt_in", true)
      .or("birthday.not.is.null,anniversary.not.is.null,first_visit_date.not.is.null");

    if (error) {
      if (error.code === "42P01") return [];
      throw new Error(error.message);
    }

    const guests = (data ?? []) as GuestRecord[];
    return deriveOccasions(guests);
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes("42P01")) return [];
    throw err;
  }
}
