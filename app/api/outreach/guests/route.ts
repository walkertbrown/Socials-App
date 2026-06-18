// GET /api/outreach/guests
// Returns all opted-in guests for the Email List view.
// Capped at 2000 rows (bounded read — the list view renders at most 150 rows).
//
// Guards:
//   1. Auth-gated.
//   2. Degrades to empty array if migration 0016 is not applied (42P01).

import { NextResponse } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { listAllGuests } from "@/lib/db/guests";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const guests = await listAllGuests();
    return NextResponse.json(guests);
  } catch (err) {
    console.error("[outreach/guests GET] error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
