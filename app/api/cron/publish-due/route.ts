import { NextResponse, type NextRequest } from "next/server";
import { claimDuePost } from "@/lib/db/posts";
import { claimDueReminder } from "@/lib/db/reminders";
import { sendReminder } from "@/lib/notify/send-reminder";
import { publishPost } from "@/lib/publish/publish-post";
import { sweepStaleStagedImages } from "@/lib/publish/cleanup-image";

export const runtime = "nodejs";
export const maxDuration = 60;

// Secret-gated cron (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
// Claims and publishes due posts ONE at a time, then sweeps orphaned staged images.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let published = 0;
  for (let i = 0; i < 5; i++) {
    const post = await claimDuePost(); // atomic status-lock: never double-claims
    if (!post) break;
    await publishPost(post);
    published += 1;
  }

  // Video posts don't auto-publish — ping her phone instead (status-locked the
  // same way, so a reminder is never sent twice). A failed push won't wedge it.
  let reminded = 0;
  for (let i = 0; i < 5; i++) {
    const post = await claimDueReminder();
    if (!post) break;
    try {
      await sendReminder(post);
    } catch {
      /* push failed (no devices / config) — it still shows on her dashboard */
    }
    reminded += 1;
  }

  await sweepStaleStagedImages();
  return NextResponse.json({ published, reminded });
}
