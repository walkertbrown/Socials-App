import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AccountSnapshot {
  platform: string;
  week_start: string;       // ISO date string 'YYYY-MM-DD'
  reach: number | null;
  views: number | null;
  net_followers: number | null;
  engagement: number | null;
  link_taps: number | null;
  followers_count: number | null;
  demographics: unknown | null;
}

// Upsert one platform snapshot for a week.
// unique(platform, week_start) makes this idempotent — re-running the cron
// for the same week safely overwrites stale numbers.
export async function upsertAccountSnapshot(snap: AccountSnapshot): Promise<void> {
  const sb = createAdminClient();
  await sb.from("weekly_account_snapshots").upsert(snap, {
    onConflict: "platform,week_start",
  });
}

// Return up to `limit` weeks of snapshots for one platform, newest first.
// Used by the trend module to check 4-week history availability.
export async function getRecentSnapshots(
  platform: string,
  limit = 8
): Promise<AccountSnapshot[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("weekly_account_snapshots")
    .select("*")
    .eq("platform", platform)
    .order("week_start", { ascending: false })
    .limit(limit);
  return (data ?? []) as AccountSnapshot[];
}

// Return snapshots for all platforms for a given week_start (used by compute-week).
export async function getSnapshotsByWeek(weekStart: string): Promise<AccountSnapshot[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("weekly_account_snapshots")
    .select("*")
    .eq("week_start", weekStart);
  return (data ?? []) as AccountSnapshot[];
}
