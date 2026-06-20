import "server-only";
// outreach-schedule.ts — read + save the send schedule (the planned batches).
// Service-role admin client. Degrades gracefully (empty/clear error) if
// migration 0018 has not been applied. The drip processor lives separately in
// lib/outreach/process-drip.ts.

import { createAdminClient } from "@/lib/supabase/admin";

export interface ScheduleRow {
  id: string;
  scheduled_date: string; // YYYY-MM-DD
  target_count: number;
  sent_count: number;
  status: string; // 'pending' | 'done'
  note: string | null;
  created_at: string;
  updated_at: string;
}

const NOT_CREATED = "Scheduler table not created yet — apply migration 0018_outreach_scheduler.sql.";

// ── Read ────────────────────────────────────────────────────────────────────
export async function listSchedule(): Promise<ScheduleRow[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("outreach_schedule")
    .select("*")
    .order("scheduled_date", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ScheduleRow[];
}

// ── Save (diff-based: update existing, insert new, delete removed) ───────────
export interface SaveRow {
  id?: string;
  scheduled_date: string;
  target_count: number;
  note?: string | null;
}

export async function saveSchedule(rows: SaveRow[]): Promise<ScheduleRow[]> {
  const sb = createAdminClient();

  const { data: existing, error: exErr } = await sb.from("outreach_schedule").select("id");
  if (exErr) {
    if (exErr.code === "42P01") throw new Error(NOT_CREATED);
    throw new Error(exErr.message);
  }
  const existingIds = new Set((existing ?? []).map((r) => (r as { id: string }).id));
  const keepIds = new Set(rows.filter((r) => r.id).map((r) => r.id as string));

  // Delete rows the user removed.
  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length) {
    const { error } = await sb.from("outreach_schedule").delete().in("id", toDelete);
    if (error) throw new Error(error.message);
  }

  // Update kept rows (date / count / note only — never touches status or sent_count,
  // so a completed batch stays 'done' with its recorded send count).
  const now = new Date().toISOString();
  for (const r of rows.filter((r) => r.id)) {
    const { error } = await sb
      .from("outreach_schedule")
      .update({ scheduled_date: r.scheduled_date, target_count: r.target_count, note: r.note ?? null, updated_at: now })
      .eq("id", r.id as string);
    if (error) throw new Error(error.message);
  }

  // Insert new rows.
  const inserts = rows
    .filter((r) => !r.id)
    .map((r) => ({ scheduled_date: r.scheduled_date, target_count: r.target_count, note: r.note ?? null }));
  if (inserts.length) {
    const { error } = await sb.from("outreach_schedule").insert(inserts);
    if (error) throw new Error(error.message);
  }

  return listSchedule();
}

// ── Reset simulation ─────────────────────────────────────────────────────────
// Undo a dry-run so you can re-run it or go live fresh: un-consume the drafts
// that were marked 'simulated' (NEVER touches real 'sent'/'failed' drafts) and
// reset any schedule row that had NO real send back to 'pending'.
export async function resetSimulation(): Promise<{ draftsReset: number }> {
  const sb = createAdminClient();
  const now = new Date().toISOString();

  const { data: cleared, error: dErr } = await sb
    .from("outreach_drafts")
    .update({ sent_at: null, send_status: null, schedule_id: null, updated_at: now })
    .eq("send_status", "simulated")
    .select("id");
  if (dErr && dErr.code !== "42P01") throw new Error(dErr.message);

  // Schedule rows touched by a REAL send stay 'done' (never resurrect a live batch).
  const { data: realRows } = await sb
    .from("outreach_drafts")
    .select("schedule_id")
    .in("send_status", ["sent", "failed"])
    .not("schedule_id", "is", null);
  const keep = new Set((realRows ?? []).map((r) => (r as { schedule_id: string }).schedule_id));

  const { data: doneRows } = await sb.from("outreach_schedule").select("id").eq("status", "done");
  const toReset = (doneRows ?? []).map((r) => (r as { id: string }).id).filter((id) => !keep.has(id));
  if (toReset.length) {
    const { error } = await sb
      .from("outreach_schedule")
      .update({ status: "pending", sent_count: 0, updated_at: now })
      .in("id", toReset);
    if (error) throw new Error(error.message);
  }

  return { draftsReset: (cleared ?? []).length };
}
