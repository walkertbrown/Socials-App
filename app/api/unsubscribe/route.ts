import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubToken } from "@/lib/outreach/unsub-token";
import { suppressEmail } from "@/lib/db/outreach-suppression";

export const runtime = "nodejs";

// Public (no auth — recipients aren't logged in). Allowlisted in proxy-session.

async function handle(email: string | null, token: string | null): Promise<boolean> {
  if (!email || !token || !verifyUnsubToken(email, token)) return false;
  await suppressEmail(email, "unsubscribe");
  return true;
}

// GET — the visible "Unsubscribe" link in the footer. Suppress, then redirect to
// the human confirmation page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const ok = await handle(searchParams.get("e"), searchParams.get("t"));
  const url = new URL("/unsubscribe", origin);
  url.searchParams.set("status", ok ? "ok" : "bad");
  return NextResponse.redirect(url);
}

// POST — RFC 8058 one-click (List-Unsubscribe-Post) from Gmail / Apple Mail.
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ok = await handle(searchParams.get("e"), searchParams.get("t"));
  return new NextResponse(ok ? "Unsubscribed" : "Invalid", { status: ok ? 200 : 400 });
}
