// PATCH /api/outreach/draft
// Updates a draft's subject and/or body, and/or toggles the approved flag.
// No sending happens here — 'approved' is a local review state only.
//
// Guards:
//   1. Auth-gated.
//   2. draft id required in body.

import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { updateDraft } from "@/lib/db/outreach-drafts";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const { id, subject, body: emailBody, approved } = (body as Record<string, unknown>);
  if (typeof id !== "string") {
    return new NextResponse("draft id required", { status: 400 });
  }

  // At least one field must be present.
  if (subject === undefined && emailBody === undefined && approved === undefined) {
    return new NextResponse("No fields to update", { status: 400 });
  }

  // Type-check the optional fields.
  if (subject !== undefined && typeof subject !== "string") {
    return new NextResponse("subject must be a string", { status: 400 });
  }
  if (emailBody !== undefined && typeof emailBody !== "string") {
    return new NextResponse("body must be a string", { status: 400 });
  }
  if (approved !== undefined && typeof approved !== "boolean") {
    return new NextResponse("approved must be a boolean", { status: 400 });
  }

  try {
    const draft = await updateDraft({
      id,
      subject:  subject as string | undefined,
      body:     emailBody as string | undefined,
      approved: approved as boolean | undefined,
    });
    return NextResponse.json(draft);
  } catch (err) {
    console.error("[outreach/draft PATCH] error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
