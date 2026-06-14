// Read-only: confirm every column/table the migrations 0005–0009 should have added
// actually exists. Run: node --env-file=.env.local scripts/verify-schema.mjs
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Each check: a table + columns we expect to be selectable.
const checks = [
  ["scheduled_posts", "platform, delivery, media_type, post_group_id, ai_draft, is_exemplar, source, insights_fetched_at"],
  ["push_subscriptions", "endpoint, p256dh, auth"],
  ["post_insights", "reach, views, likes, saves, shares"],
  ["hashtag_vocab", "tag, use_count, perf_score"],
  ["style_note", "note, pairs_since_last_run"],
  ["weekly_account_snapshots", "platform, week_start, net_followers, demographics"],
  ["weekly_reports", "week_start, win_text, narratives_generated_at"],
  ["report_goal", "goal"],
  ["graphics", "design_spec, png_path, size, status"],
  ["photos", "text_safe"],
];

let ok = 0, bad = 0;
for (const [table, cols] of checks) {
  const { error } = await sb.from(table).select(cols).limit(1);
  if (error) { console.log(`✗ ${table.padEnd(26)} ${error.message}`); bad++; }
  else { console.log(`✓ ${table.padEnd(26)} (${cols.split(",").length} cols ok)`); ok++; }
}

// Storage buckets the migrations create.
const { data: buckets } = await sb.storage.listBuckets();
const names = (buckets ?? []).map((b) => b.id);
for (const b of ["post-images", "post-videos", "graphics", "thumbnails"]) {
  console.log(names.includes(b) ? `✓ bucket ${b}` : `✗ bucket ${b} MISSING`);
}

console.log(`\n${bad === 0 ? "ALL GOOD" : bad + " PROBLEM(S)"} — ${ok}/${checks.length} table checks passed.`);
