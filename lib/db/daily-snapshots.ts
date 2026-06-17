import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DailySnapshot {
  platform: string;
  week_start: string;       // ISO date string 'YYYY-MM-DD' — always the current week's Monday
  reach: number | null;
  views: number | null;
  net_followers: number | null;
  engagement: number | null;
  link_taps: number | null;
  followers_count: number | null;
  captured_at: string;      // ISO timestamptz — when Meta responded (shown in the UI label)
  updated_at?: string;      // set by DB on every upsert
}

// Upsert one platform snapshot for the current week.
// Unique(platform, week_start) makes this idempotent — calling multiple times
// for the same Monday overwrites the row rather than growing the table.
export async function upsertDailySnapshot(
  snap: Omit<DailySnapshot, "updated_at">
): Promise<void> {
  const sb = createAdminClient();
  await sb.from("daily_account_snapshots").upsert(
    { ...snap, updated_at: snap.captured_at },
    { onConflict: "platform,week_start" }
  );
}

// Return the most recent row for each platform (IG + FB).
// Used by the Insights page to render the "This week so far" strip.
// Returns an empty array if the table has no data yet — never throws.
export async function getLatestDailySnapshots(): Promise<DailySnapshot[]> {
  const sb = createAdminClient();

  // Fetch the latest row for instagram and facebook in one query by ordering
  // captured_at DESC and limiting to 1 per platform via a subquery approach.
  // Supabase JS doesn't support DISTINCT ON directly, so we fetch the latest
  // 2 rows overall after ordering — that works because we only have 2 platforms.
  const platforms = ["instagram", "facebook"] as const;
  const results: DailySnapshot[] = [];

  await Promise.all(
    platforms.map(async (platform) => {
      const { data } = await sb
        .from("daily_account_snapshots")
        .select("*")
        .eq("platform", platform)
        .order("captured_at", { ascending: false })
        .limit(1);
      if (data?.[0]) results.push(data[0] as DailySnapshot);
    })
  );

  return results;
}
