import "server-only";
import webpush from "web-push";
import { listSubscriptions, removeSubscription } from "@/lib/db/push-subscriptions";

export interface PushPayload {
  title: string;
  body: string;
  url: string; // where tapping the notification should take her
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:walkertbrown@gmail.com",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

// Push a notification to every subscribed device. Dead subscriptions (the push
// service returns 404/410) are pruned so they don't pile up. Returns how many
// devices were reached.
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  if (!configure()) throw new Error("Missing VAPID keys (push not configured)");
  const subs = await listSubscriptions();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await removeSubscription(s.endpoint);
      }
    })
  );
  return sent;
}
