import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { setDisplayName } from "@/lib/db/photos";

export const runtime = "nodejs";

// POST { id: string, name: string } → updates display_name on the photo.
// The display_name is what shows on the board and is used as the download filename.
// Sanitization (trim + 200-char cap) happens in setDisplayName so the DB stays clean.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const { id, name } = body ?? {};
  if (typeof id !== "string" || typeof name !== "string") {
    return new NextResponse("Bad request: id and name must be strings", { status: 400 });
  }

  const cleaned = await setDisplayName(id, name);
  return NextResponse.json({ ok: true, display_name: cleaned });
}
