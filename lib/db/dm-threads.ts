import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type DmThread = {
  id: string;
  platform: "instagram" | "facebook";
  thread_id: string;
  participant_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  auto_replied_at: string | null;
  created_at: string;
};

export type DmMessage = {
  id: string;
  thread_id: string;
  platform_message_id: string;
  direction: "inbound" | "outbound";
  body: string;
  sent_at: string;
  auto_reply_rule_id: string | null;
  created_at: string;
};

// Upsert a thread row keyed on thread_id. Increments unread_count on conflict.
// Returns the internal db id of the thread.
export async function upsertDmThread(params: {
  platform: "instagram" | "facebook";
  thread_id: string;
  participant_name?: string | null;
  last_message_at: string;
  last_message_preview: string;
}): Promise<string> {
  const sb = createAdminClient();

  const { data: existing } = await sb
    .from("dm_threads")
    .select("id, unread_count, participant_name")
    .eq("thread_id", params.thread_id)
    .maybeSingle();

  if (existing) {
    await sb
      .from("dm_threads")
      .update({
        last_message_at: params.last_message_at,
        last_message_preview: params.last_message_preview,
        unread_count: existing.unread_count + 1,
        // Only update name if we have one and don't already
        ...(params.participant_name && !existing.participant_name
          ? { participant_name: params.participant_name }
          : {}),
      })
      .eq("id", existing.id)
      .throwOnError();
    return existing.id as string;
  }

  const { data, error } = await sb
    .from("dm_threads")
    .insert({
      platform: params.platform,
      thread_id: params.thread_id,
      participant_name: params.participant_name ?? null,
      last_message_at: params.last_message_at,
      last_message_preview: params.last_message_preview,
      unread_count: 1,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

// Insert a message row. If platform_message_id already exists, does nothing
// (idempotency for Meta's at-least-once webhook delivery).
export async function insertDmMessageIfNew(params: {
  thread_id: string;
  platform_message_id: string;
  direction: "inbound" | "outbound";
  body: string;
  sent_at: string;
  auto_reply_rule_id?: string | null;
}): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("dm_messages")
    .upsert(
      {
        thread_id: params.thread_id,
        platform_message_id: params.platform_message_id,
        direction: params.direction,
        body: params.body,
        sent_at: params.sent_at,
        auto_reply_rule_id: params.auto_reply_rule_id ?? null,
      },
      { onConflict: "platform_message_id", ignoreDuplicates: true }
    )
    .throwOnError();
}

export async function getAllDmThreads(): Promise<DmThread[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("dm_threads")
    .select("*")
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DmThread[];
}

export async function getDmMessages(thread_db_id: string): Promise<DmMessage[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("dm_messages")
    .select("*")
    .eq("thread_id", thread_db_id)
    .order("sent_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DmMessage[];
}

export async function clearUnreadCount(thread_db_id: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("dm_threads")
    .update({ unread_count: 0 })
    .eq("id", thread_db_id)
    .throwOnError();
}

export async function stampAutoReplied(thread_db_id: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("dm_threads")
    .update({ auto_replied_at: new Date().toISOString() })
    .eq("id", thread_db_id)
    .throwOnError();
}

// True if the thread already has at least one outbound message — meaning this
// is NOT an opening exchange and the 24h auto-reply window rule doesn't apply.
export async function hasOutboundMessages(thread_db_id: string): Promise<boolean> {
  const sb = createAdminClient();
  const { count, error } = await sb
    .from("dm_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", thread_db_id)
    .eq("direction", "outbound");
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// True if auto_replied_at is already stamped — idempotency guard.
export async function isAutoReplied(thread_db_id: string): Promise<boolean> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("dm_threads")
    .select("auto_replied_at")
    .eq("id", thread_db_id)
    .maybeSingle();
  return data?.auto_replied_at != null;
}
