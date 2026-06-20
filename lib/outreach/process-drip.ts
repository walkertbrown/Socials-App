import "server-only";
// process-drip.ts — the sendable pool + the daily drip processor.
// STEP 1: dry-run only. processDueBatch({ dryRun: true }) marks the picked
// drafts 'simulated' and sends NOTHING. Step 2 will pass dryRun:false and add
// the live Resend call where the simulate stamp happens.

import { createAdminClient } from "@/lib/supabase/admin";
import { todayChicago } from "@/lib/outreach/schedule-plan";

interface PoolDraft {
  id: string;
  email: string;
}

// Approved, unsent drafts whose guest is opted-in, not 'invalid', not suppressed.
// (Step 1 includes unverified guests — verification only hard-gates the real
// send in Step 2.) Filtered in code so a NULL verify status counts as sendable.
async function loadPool(): Promise<PoolDraft[]> {
  const sb = createAdminClient();

  const { data, error } = await sb
    .from("outreach_drafts")
    .select("id, guests!inner ( email, marketing_opt_in, email_verify_status )")
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

  const pool: PoolDraft[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const g = row.guests as { email: string; marketing_opt_in: boolean; email_verify_status: string | null } | null;
    if (!g || !g.marketing_opt_in) continue;
    if (g.email_verify_status === "invalid") continue;
    if (suppressed.has(g.email.toLowerCase())) continue;
    pool.push({ id: row.id as string, email: g.email });
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
  if (picked.length > 0) {
    // STEP 2 INSERT POINT: before this update, fire the real Resend send for
    // `picked` and set send_status from the per-email result.
    const { error: upErr } = await sb
      .from("outreach_drafts")
      .update({
        sent_at: stamp,
        send_status: opts.dryRun ? "simulated" : "sent",
        schedule_id: batch.id,
        updated_at: stamp,
      })
      .in("id", picked.map((p) => p.id));
    if (upErr) throw new Error(upErr.message);
  }

  const { error: schErr } = await sb
    .from("outreach_schedule")
    .update({ status: "done", sent_count: picked.length, updated_at: stamp })
    .eq("id", batch.id);
  if (schErr) throw new Error(schErr.message);

  return {
    ran: true,
    batchId: batch.id,
    scheduled_date: batch.scheduled_date,
    requested: batch.target_count,
    sent: picked.length,
    shortfall: Math.max(0, batch.target_count - picked.length),
    dryRun: opts.dryRun,
  };
}
