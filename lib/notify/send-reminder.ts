import "server-only";
import type { ScheduledPost } from "@/lib/db/posts";
import { sendPushToAll } from "@/lib/notify/web-push";

// Ping her phone that it's time to post a scheduled video. Tapping the
// notification opens the post-time screen for that post.
export async function sendReminder(post: ScheduledPost): Promise<number> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const where = post.platforms.join(" + ");
  return sendPushToAll({
    title: "Time to post your video 🎬",
    body: `Tap to grab the video + caption for ${where}.`,
    url: `${base}/post/${post.id}`,
  });
}
