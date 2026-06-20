import "server-only";
// process-drip.ts — the sendable pool + the daily drip processor.
//
// dryRun=true  → marks the picked drafts 'simulated' and sends NOTHING
//                (Step 1, and the manual "Run due batch" button always).
// dryRun=false → LIVE: claim-before-send, then Resend each (idempotency key =
//                draft id), then stamp 'sent' / 'failed'. Reached only when the
//                cron passes dryRun:false, which it does only when isLiveSending().

import { createAdminClient } from "@/lib/supabase/admin";
import { todayChicago } from "@/lib/outreach/schedule-plan";
import { sendDraftBatch, type SendableDraft } from "@/lib/outreach/send-email";

// Approved, unsent drafts whose guest is opted-in, not 'invalid', not suppressed.
// (Step 1 includes unverified guests — verification only hard-gates later.)
// Filtered in code so a NULL verify status counts as sendable.
async function loadPool(): Promise<SendableDraft[]> {
  const sb = createAdminClient();

  const { data, error } = await sb
    .from("outreach_drafts")
    .select("id, subject, body, guests!inner ( email, marketing_opt_in, email_verify_status )")
    .eq("status", "approved")
    .is("sent_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }

  const { data: supp, error: sErr } = await sb.from("outreach_suppression").select("email");
  if (sErr && sErr.code !== "42P01") throw new Error(sErr.message);
  const suppressed = new Set((supp ?? []).map((r) => (r as { email: string }).email.toLowerCase()));

  const pool: SendableDraft[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const g = row.guests as { email: string; marketing_opt_in: boolean; email_verify_status: string | null } | null;
    if (!g || !g.marketing_opt_in) continue;
    if (g.email_verify_status === "invalid") continue;
    if (suppressed.has(g.email.toLowerCase())) continue;
    pool.push({ id: row.id as string, email: g.email, subject: row.subject as string, body: row.body as string });
  }
  return pool;
}

export async function countSendablePool(): Promise<number> {
  return (await loadPool()).length;
}

export interface DripResult {
  ran: boolean;
  reason?: "not_configured" | "nothing_due";
  batchId?: string;
  scheduled_date?: string;
  requested?: number;
  sent?: number;
  shortfall?: number;
  dryRun: boolean;
}

// Process the earliest pending batch dated on/before today. One batch per call,
// so a daily cron sends at most one batch per day.
export async function processDueBatch(opts: { dryRun: boolean }): Promise<DripResult> {
  const sb = createAdminClient();
  const today = todayChicago();

  const { data: due, error } = await sb
    .from("outreach_schedule")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_date", today)
    .order("scheduled_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return { ran: false, reason: "not_configured", dryRun: opts.dryRun };
    throw new Error(error.message);
  }
  if (!due) return { ran: false, reason: "nothing_due", dryRun: opts.dryRun };

  const batch = due as { id: string; scheduled_date: string; target_count: number };
  const pool = await loadPool();
  const picked = pool.slice(0, batch.target_count);
  const stamp = new Date().toISOString();
  let sentCount = 0;

  if (picked.length > 0) {
    const ids = picked.map((p) => p.id);

    // CLAIM BEFORE SEND: stamp sent_at now so a re-fire / crash can never re-pick
    // these drafts (sent_at non-null drops them from the pool). Dry-run lands
    // straight on 'simulated'; live lands on the transient 'sending'.
    const { error: claimErr } = await sb
      .from("outreach_drafts")
      .update({ sent_at: stamp, send_status: opts.dryRun ? "simulated" : "sending", schedule_id: batch.id, updated_at: stamp })
      .in("id", ids);
    if (claimErr) throw new Error(claimErr.message);

    if (opts.dryRun) {
      sentCount = picked.length;
    } else {
      const { sentIds, failedIds } = await sendDraftBatch(picked);
      const now = new Date().toISOString();
      if (sentIds.length) {
        await sb.from("outreach_drafts").update({ send_status: "sent", updated_at: now }).in("id", sentIds);
      }
      if (failedIds.length) {
        // Failures keep sent_at set (not auto-retried — no retry storm on a fresh
        // domain); they're queryable by send_status='failed' for follow-up.
        await sb.from("outreach_drafts").update({ send_status: "failed", updated_at: now }).in("id", failedIds);
      }
      sentCount = sentIds.length;
    }
  }

  const { error: schErr } = await sb
    .from("outreach_schedule")
    .update({ status: "done", sent_count: sentCount, updated_at: stamp })
    .eq("id", batch.id);
  if (schErr) throw new Error(schErr.message);

  return {
    ran: true,
    batchId: batch.id,
    scheduled_date: batch.scheduled_date,
    requested: batch.target_count,
    sent: sentCount,
    shortfall: Math.max(0, batch.target_count - sentCount),
    dryRun: opts.dryRun,
  };
}
