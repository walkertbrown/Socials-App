// POST /api/outreach/generate
// Generates ONE guest's draft email per call. The client loops sequentially.
//
// Guards:
//   1. Auth-gated.
//   2. Skip if the guest already has a draft (status=draft or approved).
//   3. Standard guests make 0 LLM calls — merges a template only.
//   4. Only generates for guests whose email_verify_status='valid' (or where
//      NeverBounce is not configured, so the feature works without a key).
//   5. occasion_type is optional — pass it for Occasions-tab drafts.

import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { generateOne } from "@/lib/outreach/generate-one";
import type { OccasionType } from "@/lib/outreach/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_OCCASION_TYPES: OccasionType[] = [
  "birthday",
  "anniversary",
  "first_visit_anniversary",
];

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const { guest_id, occasion_type, skipVerify } = (body as Record<string, unknown>);
  if (typeof guest_id !== "string") {
    return new NextResponse("guest_id required", { status: 400 });
  }

  // Validate occasion_type if provided.
  let parsedOccasion: OccasionType | null = null;
  if (occasion_type !== undefined && occasion_type !== null) {
    if (!VALID_OCCASION_TYPES.includes(occasion_type as OccasionType)) {
      return new NextResponse("Invalid occasion_type", { status: 400 });
    }
    parsedOccasion = occasion_type as OccasionType;
  }

  const shouldSkipVerify = skipVerify === true;

  try {
    const result = await generateOne(guest_id, parsedOccasion, shouldSkipVerify);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[outreach/generate] guest ${guest_id} failed:`, err);
    return NextResponse.json(
      { guest_id, status: "error", message: (err as Error).message },
      { status: 500 }
    );
  }
}
