import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { markPosted } from "@/lib/db/reminders";

export const runtime = "nodejs";

// She tapped "Mark as posted" on the post-time screen — the only signal the app
// gets that a reminder post actually went out (it can't detect the manual post).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  await markPosted(id);
  return NextResponse.json({ ok: true });
}
