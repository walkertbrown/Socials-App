import "server-only";
// outreach-suppression.ts — the do-not-send list. Populated by unsubscribes and
// by Resend bounce/complaint webhooks; the sendable pool excludes anything here.

import { createAdminClient } from "@/lib/supabase/admin";

export type SuppressionReason = "unsubscribe" | "bounce" | "complaint" | "manual";

// Idempotent on the email PK (re-suppressing is a no-op). Lowercased to match
// the pool's case-insensitive exclusion.
export async function suppressEmail(email: string, reason: SuppressionReason): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb
    .from("outreach_suppression")
    .upsert({ email: email.toLowerCase(), reason }, { onConflict: "email" });
  if (error && error.code !== "42P01") throw new Error(error.message);
}

export async function isSuppressed(email: string): Promise<boolean> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("outreach_suppression")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error && error.code !== "42P01") throw new Error(error.message);
  return !!data;
}
