import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { approvePhoto } from "@/lib/db/photos";

export const runtime = "nodejs";

// Moves a pending_review photo to ready (visible on the main board).
// drive_placed_at stays NULL — the box job stamps it after copying to Drive.
//
// Request body: { id: string }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return new NextResponse("Bad request: id required", { status: 400 });
  }

  await approvePhoto(body.id);
  return NextResponse.json({ ok: true });
}
