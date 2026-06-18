// POST /api/outreach/verify
// Verifies ONE guest's email address via NeverBounce. The client calls this
// sequentially for each guest — never batched in parallel (cost-watchdog rule).
//
// Guards:
//   1. Auth-gated.
//   2. Verify-once cache: if status is already set and verified within 90 days,
//      returns the cached status WITHOUT calling NeverBounce.
//   3. Graceful quota exhaustion: if NeverBounce reports out of credits,
//      stores 'pending', returns a quota_exhausted flag (does NOT hard-fail).
//   4. Never called on CSV import — only from the generation loop.

import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { verifyEmail } from "@/lib/outreach/verify-email";
import { setVerifyStatus } from "@/lib/db/guests";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GuestRecord } from "@/lib/outreach/types";

export const runtime = "nodejs";

// 90 days in milliseconds.
const VERIFY_CACHE_MS = 90 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const { guest_id } = (body as Record<string, unknown>);
  if (typeof guest_id !== "string") {
    return new NextResponse("guest_id required", { status: 400 });
  }

  // Load guest to check the verify-once cache.
  const sb = createAdminClient();
  const { data, error: fetchErr } = await sb
    .from("guests")
    .select("id, email, email_verify_status, email_verified_at")
    .eq("id", guest_id)
    .maybeSingle();

  if (fetchErr) {
    // Table not found — migration not applied.
    if (fetchErr.code === "42P01") {
      return NextResponse.json({ status: "not_configured", guest_id });
    }
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!data) {
    return new NextResponse("Guest not found", { status: 404 });
  }

  const guest = data as Pick<GuestRecord, "id" | "email" | "email_verify_status" | "email_verified_at">;

  // Verify-once cache: if status is set and verified_at is within 90 days, skip NeverBounce.
  if (guest.email_verify_status && guest.email_verified_at) {
    const verifiedMs = new Date(guest.email_verified_at).getTime();
    const ageMs = Date.now() - verifiedMs;
    if (ageMs < VERIFY_CACHE_MS) {
      return NextResponse.json({
        guest_id,
        status:   guest.email_verify_status,
        cached:   true,
      });
    }
  }

  // Call the email verifier (MyEmailVerifier).
  const result = await verifyEmail(guest.email);

  // Graceful quota exhaustion: store 'pending' so we don't retry endlessly.
  if (result.quota_exhausted) {
    await setVerifyStatus(guest_id, "pending");
    return NextResponse.json({
      guest_id,
      status:          "pending",
      quota_exhausted: true,
      message:         "Email-verification limit reached. The free tier resets daily (100/day) — continue tomorrow, or add credits.",
    });
  }

  // Store the verified status.
  await setVerifyStatus(guest_id, result.status);

  return NextResponse.json({ guest_id, status: result.status, cached: false });
}
