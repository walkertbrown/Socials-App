import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AutoReplyRule = {
  id: string;
  trigger_pattern: string;
  reply_text: string;
  active: boolean;
  created_at: string;
};

export async function getActiveRules(): Promise<AutoReplyRule[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("auto_reply_rules")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AutoReplyRule[];
}

export async function getAllRules(): Promise<AutoReplyRule[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("auto_reply_rules")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AutoReplyRule[];
}

export async function createRule(params: {
  trigger_pattern: string;
  reply_text: string;
}): Promise<AutoReplyRule> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("auto_reply_rules")
    .insert({ trigger_pattern: params.trigger_pattern, reply_text: params.reply_text })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AutoReplyRule;
}

export async function toggleRule(id: string, active: boolean): Promise<void> {
  const sb = createAdminClient();
  await sb.from("auto_reply_rules").update({ active }).eq("id", id).throwOnError();
}

export async function deleteRule(id: string): Promise<void> {
  const sb = createAdminClient();
  await sb.from("auto_reply_rules").delete().eq("id", id).throwOnError();
}
