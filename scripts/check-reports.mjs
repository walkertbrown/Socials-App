// Read-only: show the state of the weekly-report tables + the latest report's
// contents. Run: node --env-file=.env.local scripts/check-reports.mjs
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

for (const t of ["weekly_reports", "weekly_account_snapshots", "post_insights"]) {
  const { count } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(`${t.padEnd(26)} ${count} rows`);
}

// How many of her posts does the app know about at all?
const { count: posts } = await sb.from("scheduled_posts").select("*", { count: "exact", head: true });
const { count: pub } = await sb
  .from("scheduled_posts")
  .select("*", { count: "exact", head: true })
  .in("status", ["published", "posted"]);
console.log(`scheduled_posts            ${posts} rows (${pub} published/posted)`);

const { data: rep } = await sb
  .from("weekly_reports")
  .select("week_start,status,narratives_generated_at,win_text,payload")
  .order("week_start", { ascending: false })
  .limit(1)
  .maybeSingle();

if (!rep) {
  console.log("\n→ NO weekly_reports row exists yet. The /insights page has nothing to show.");
} else {
  console.log("\nlatest report:", rep.week_start, "| status:", rep.status, "| narratives:", rep.narratives_generated_at ? "yes" : "no");
  const p = rep.payload || {};
  console.log("  payload keys:", Object.keys(p).join(", ") || "(empty)");
  for (const k of ["posts", "postTable", "perPost", "snapshot", "account"]) {
    if (p[k]) console.log(`  payload.${k}:`, Array.isArray(p[k]) ? `${p[k].length} items` : JSON.stringify(p[k]).slice(0, 120));
  }
  console.log("  win_text:", (rep.win_text || "(none)").slice(0, 120));
}
