import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { saveSubscription } from "@/lib/db/push-subscriptions";

export const runtime = "nodejs";

// Save her phone's push subscription so reminders can reach it. Body is a browser
// PushSubscription JSON: { endpoint, keys: { p256dh, auth } }.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const sub = await request.json();
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    await saveSubscription({ endpoint, p256dh, auth });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
