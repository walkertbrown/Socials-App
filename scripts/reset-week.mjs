// One-off: clear a single week's cached report so the corrected insights code
// re-fetches from Meta on the next weekly-report run. Never touches photos or
// posts — only the report row, that week's account snapshots, and the
// per-post "already fetched" flags (so syncInsights re-pulls).
//
//   node --env-file=.env.local scripts/reset-week.mjs 2026-06-01
import { createClient } from "@supabase/supabase-js";

const week = process.argv[2];
if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
  console.error("Usage: node --env-file=.env.local scripts/reset-week.mjs YYYY-MM-DD");
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 1. Drop the cached weekly report for the week (releases the idempotency lock).
const r1 = await sb.from("weekly_reports").delete().eq("week_start", week).select("week_start");
console.log(`weekly_reports        deleted ${r1.data?.length ?? 0}`);

// 2. Drop that week's account snapshots so reach/views/followers re-fetch.
const r2 = await sb.from("weekly_account_snapshots").delete().eq("week_start", week).select("platform");
console.log(`account_snapshots     deleted ${r2.data?.length ?? 0}`);

// 3. Make published posts eligible for a fresh insights pull (clear staleness +
//    final flags). The all-null rows in post_insights get overwritten on re-sync.
const r3 = await sb
  .from("scheduled_posts")
  .update({ insights_fetched_at: null, insights_final: false })
  .eq("status", "published")
  .select("id");
console.log(`scheduled_posts reset ${r3.data?.length ?? 0} (insights_fetched_at -> null)`);

console.log("\nDone. Re-run the weekly-report cron to regenerate this week with corrected data.");
