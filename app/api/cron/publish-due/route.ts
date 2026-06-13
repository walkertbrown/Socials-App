import { NextResponse, type NextRequest } from "next/server";
import { claimDuePost } from "@/lib/db/posts";
import { claimDueVideoPost, claimVideoInFlight } from "@/lib/db/video-posts";
import { claimDueReminder } from "@/lib/db/reminders";
import { sendReminder } from "@/lib/notify/send-reminder";
import { publishPost } from "@/lib/publish/publish-post";
import { startVideoPublish, advanceVideoPublish } from "@/lib/publish/publish-video";
import { sweepStaleStagedImages } from "@/lib/publish/cleanup-image";
import { sweepStaleStagedVideos } from "@/lib/publish/cleanup-video";
import { recoverStuck } from "@/lib/publish/recover-stuck";

export const runtime = "nodejs";
export const maxDuration = 60;

// Secret-gated cron (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
// Each loop is bounded at ≤5 items to stay within maxDuration.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ── 1. Photo auto-publish (synchronous, fast) ────────────────────────────
  let published = 0;
  for (let i = 0; i < 5; i++) {
    const post = await claimDuePost(); // image/auto only
    if (!post) break;
    await publishPost(post);
    published += 1;
  }

  // ── 2. Video Reel: start new posts (tick 1: stage + container/upload kick) ─
  let videosStarted = 0;
  for (let i = 0; i < 5; i++) {
    const post = await claimDueVideoPost();
    if (!post) break;
    await startVideoPublish(post);
    videosStarted += 1;
  }

  // ── 3. Video Reel: advance in-flight posts (poll IG / finish FB) ───────────
  let videosAdvanced = 0;
  for (let i = 0; i < 5; i++) {
    const post = await claimVideoInFlight();
    if (!post) break;
    await advanceVideoPublish(post);
    videosAdvanced += 1;
  }

  // ── 4. Reminder pings (video posts set to 'reminder' delivery) ────────────
  // Video posts don't auto-publish — ping her phone instead. The status flip is
  // the lock so a reminder is never sent twice.
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

  // ── 5. Maintenance: recover stuck posts + sweep orphaned staged files ──────
  await recoverStuck();
  await sweepStaleStagedImages();
  await sweepStaleStagedVideos();

  return NextResponse.json({ published, videosStarted, videosAdvanced, reminded });
}
