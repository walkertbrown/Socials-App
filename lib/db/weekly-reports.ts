import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface WeeklyReport {
  id: string;
  week_start: string;           // 'YYYY-MM-DD'
  status: string;
  payload: unknown | null;
  win_text: string | null;
  recommend_text: string | null;
  flag_text: string | null;
  narratives_generated_at: string | null;
  generated_at: string | null;
  created_at: string;
}

// Insert the shell row for a week, doing nothing if it already exists.
// Returns true if a new row was inserted, false if the row already existed
// (the ON CONFLICT DO NOTHING is the idempotency lock — whoever inserts first
// owns this week's computation).
export async function insertReportShell(weekStart: string): Promise<boolean> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("weekly_reports")
    .insert({ week_start: weekStart, status: "pending" })
    .select("id");
  // error with code 23505 = unique violation → row already exists.
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

// Store the computed payload and mark the report generated (not narratives yet).
export async function saveReportPayload(
  weekStart: string,
  payload: unknown
): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("weekly_reports")
    .update({
      payload,
      status: "ready",
      generated_at: new Date().toISOString(),
    })
    .eq("week_start", weekStart);
}

// Save both Claude narratives and set the narratives_generated_at timestamp.
// The timestamp is the cost guard — the cron skips both Claude calls if it's set.
export async function saveNarratives(
  weekStart: string,
  win: string,
  recommend: string,
  flag: string
): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("weekly_reports")
    .update({
      win_text: win,
      recommend_text: recommend,
      flag_text: flag,
      narratives_generated_at: new Date().toISOString(),
      status: "complete",
    })
    .eq("week_start", weekStart);
}

// Null out narratives_generated_at so the next cron run regenerates them.
// Used by the explicit "Regenerate" action — never called by the cron.
export async function clearNarratives(weekStart: string): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("weekly_reports")
    .update({
      win_text: null,
      recommend_text: null,
      flag_text: null,
      narratives_generated_at: null,
      status: "ready",
    })
    .eq("week_start", weekStart);
}

// Fetch the most recent complete (or ready) report. Used by the insights screen.
export async function getLatestReport(): Promise<WeeklyReport | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("weekly_reports")
    .select("*")
    .in("status", ["complete", "ready"])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as WeeklyReport) ?? null;
}

// Fetch a report by week_start string. Used by the week picker and PDF route.
export async function getReportByWeek(weekStart: string): Promise<WeeklyReport | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("weekly_reports")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  return (data as WeeklyReport) ?? null;
}

// Return the list of weeks that have reports (for the week picker).
export async function listReportWeeks(): Promise<string[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("weekly_reports")
    .select("week_start")
    .in("status", ["complete", "ready"])
    .order("week_start", { ascending: false })
    .limit(52);
  return (data ?? []).map((r: { week_start: string }) => r.week_start);
}
