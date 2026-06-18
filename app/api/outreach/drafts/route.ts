// GET /api/outreach/drafts
// Returns all draft and approved outreach_drafts, joined with guest name + email.
// Used by the Send-off gallery.
//
// Guards:
//   1. Auth-gated.
//   2. Degrades to empty array if migration 0016 is not applied.

import { NextResponse } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { listSendoffDrafts } from "@/lib/db/outreach-drafts";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const drafts = await listSendoffDrafts();
    return NextResponse.json(drafts);
  } catch (err) {
    console.error("[outreach/drafts GET] error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
