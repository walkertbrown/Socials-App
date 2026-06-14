// Focused follow-up probe: dump the RAW shape of the ambiguous metrics so we know
// definitively whether they carry data for @thepelicanclubnola. Read-only.
// Run: node --env-file=.env.local scripts/probe-insights-2.mjs
import { createClient } from "@supabase/supabase-js";

const GRAPH = "https://graph.facebook.com/v25.0";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: c } = await sb.from("meta_credentials").select("page_id, ig_user_id, page_token").eq("id", 1).maybeSingle();
const TOKEN = c.page_token, IG = c.ig_user_id, PAGE = c.page_id;
const q = (path, params) => `${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: TOKEN })}`;

async function dump(label, url) {
  const j = await (await fetch(url)).json();
  if (j.error) { console.log(`\n✗ ${label}\n   ERROR: ${j.error.message}`); return; }
  const d = j.data?.[0];
  if (!d) { console.log(`\n? ${label}\n   (no data array)`); return; }
  const val = d.total_value?.value ?? d.values?.[0]?.value;
  console.log(`\n✓ ${label}`);
  console.log("   value: " + String(JSON.stringify(val)).slice(0, 350));
  if (val === undefined) console.log("   raw data[0]: " + String(JSON.stringify(d)).slice(0, 350));
}

console.log("=== IG follower_demographics (does it carry real audience data?) ===");
await dump("follower_demographics / age", q(`${IG}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "age" }));
await dump("follower_demographics / gender", q(`${IG}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "gender" }));
await dump("follower_demographics / city", q(`${IG}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "city" }));

console.log("\n=== IG follower growth ===");
await dump("follows_and_unfollows", q(`${IG}/insights`, { metric: "follows_and_unfollows", period: "day", metric_type: "total_value", breakdown: "follow_type" }));

console.log("\n=== IG online_followers (best-times spine — raw) ===");
const of = await (await fetch(q(`${IG}/insights`, { metric: "online_followers", period: "lifetime" }))).json();
console.log(of.error ? "   ERROR: " + of.error.message : "   " + JSON.stringify(of.data?.[0]?.values?.slice(0, 2) ?? of.data).slice(0, 500));

console.log("\n=== FB follower-growth metric name (page_fan_adds was invalid) ===");
for (const m of ["page_follows", "page_daily_follows_unique", "page_fan_adds_unique"]) {
  const j = await (await fetch(q(`${PAGE}/insights`, { metric: m, period: "week" }))).json();
  console.log(`   ${m.padEnd(26)} ${j.error ? "✗ " + j.error.message.slice(0, 60) : "✓ " + JSON.stringify(j.data?.[0]?.values?.[0]?.value)}`);
}

console.log("\nDone — read-only.\n");
