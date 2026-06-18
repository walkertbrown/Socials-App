// POST /api/outreach/ingest
// Accepts a JSON array of normalized guest rows from the browser (the browser
// parses the CSV and sends clean rows — we never receive the raw 6MB PII file).
//
// Guards:
//   1. Auth-gated (getUserOrNull — same pattern as /api/photos/pick).
//   2. Only opted-in rows (marketing_opt_in === true) are written.
//   3. Payloads over 5,000 rows are rejected to prevent an accidental
//      full-50k ingest of an unfiltered export.
//   4. Upsert on email — idempotent; re-uploads never duplicate rows.

import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { upsertGuests, getGuestBucketCounts } from "@/lib/db/guests";
import { normalizeGuest } from "@/lib/outreach/normalize-guest";
import type { RawGuestRow } from "@/lib/outreach/types";

export const runtime = "nodejs";

const MAX_ROWS = 5_000;

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (!Array.isArray(body)) {
    return new NextResponse("Expected an array of rows", { status: 400 });
  }

  if (body.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `Too many rows (${body.length}). Upload one recency tier/cohort at a time ` +
               `(max ${MAX_ROWS.toLocaleString()}) — e.g. your last-365-day warm list — not the full export.`,
      },
      { status: 413 }
    );
  }

  // Normalize all rows; keep only those that opted in.
  const raw = body as RawGuestRow[];
  const normalized = raw
    .map((row) => normalizeGuest(row))
    .filter((g) => g.marketing_opt_in);

  if (normalized.length === 0) {
    return NextResponse.json({ ingested: 0, personalized: 0, standard: 0, total: 0 });
  }

  await upsertGuests(normalized);

  const counts = await getGuestBucketCounts();
  return NextResponse.json({
    ingested: normalized.length,
    ...counts,
  });
}
