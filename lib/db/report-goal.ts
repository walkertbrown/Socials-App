import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The goal is a singleton (id=1) seeded by the migration.
// Default: 'net follower growth'.
const DEFAULT_GOAL = "net follower growth";

export async function getReportGoal(): Promise<string> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("report_goal")
    .select("goal")
    .eq("id", 1)
    .maybeSingle();
  return (data as { goal: string } | null)?.goal ?? DEFAULT_GOAL;
}

// Owner-only update (no UI in v1 — reserved for future settings screen).
export async function setReportGoal(goal: string): Promise<void> {
  const sb = createAdminClient();
  await sb.from("report_goal").update({ goal }).eq("id", 1);
}
