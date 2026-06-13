import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Save (or refresh) a device's push subscription. Endpoint is unique, so a device
// re-subscribing just updates its keys instead of duplicating.
export async function saveSubscription(sub: PushSubscriptionRow): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from("push_subscriptions")
    .upsert(sub, { onConflict: "endpoint" });
  if (error) throw new Error(error.message);
}

export async function listSubscriptions(): Promise<PushSubscriptionRow[]> {
  const sb = createAdminClient();
  const { data } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth");
  return (data ?? []) as PushSubscriptionRow[];
}

// Drop a dead subscription (push service returned 404/410 — the device unsubscribed).
export async function removeSubscription(endpoint: string): Promise<void> {
  const sb = createAdminClient();
  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
