// READ-ONLY probe: for every metric the Weekly Report spec wants, hit the real
// Pelican Club IG + FB and report whether it returns data or errors out. Posts
// nothing. Run: node --env-file=.env.local scripts/probe-insights.mjs
import { createClient } from "@supabase/supabase-js";

const GRAPH = "https://graph.facebook.com/v25.0";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: c } = await sb
  .from("meta_credentials")
  .select("page_id, ig_user_id, page_token")
  .eq("id", 1)
  .maybeSingle();
if (!c?.page_token) { console.error("No stored token."); process.exit(1); }
const TOKEN = c.page_token;
const IG = c.ig_user_id;
const PAGE = c.page_id;

function short(json) {
  if (json.error) return null;
  if (Array.isArray(json.data)) {
    return json.data
      .map((m) => {
        const v = m.total_value?.value ?? m.values?.[0]?.value;
        if (v != null && typeof v === "object") return `${m.name}=[${Object.keys(v).length} breakdown rows]`;
        return `${m.name}=${v}`;
      })
      .join(", ");
  }
  return JSON.stringify(json).slice(0, 120);
}

async function probe(label, url) {
  try {
    const json = await (await fetch(url)).json();
    if (json.error) {
      console.log(`  ✗ ${label.padEnd(34)} ERROR: ${json.error.message.slice(0, 90)}`);
      return null;
    }
    console.log(`  ✓ ${label.padEnd(34)} ${short(json) ?? "ok"}`);
    return json;
  } catch (e) {
    console.log(`  ✗ ${label.padEnd(34)} fetch failed: ${e.message}`);
    return null;
  }
}
const q = (path, params) => `${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: TOKEN })}`;

console.log("\n=== INSTAGRAM — account level ===");
await probe("followers_count (node field)", q(IG, { fields: "followers_count,media_count" }));
await probe("reach (day)", q(`${IG}/insights`, { metric: "reach", period: "day" }));
await probe("views (day) [new impressions]", q(`${IG}/insights`, { metric: "views", period: "day", metric_type: "total_value" }));
await probe("profile_links_taps (day)", q(`${IG}/insights`, { metric: "profile_links_taps", period: "day", metric_type: "total_value" }));
await probe("online_followers (KEY: best-times)", q(`${IG}/insights`, { metric: "online_followers", period: "lifetime" }));
await probe("follows_and_unfollows (day)", q(`${IG}/insights`, { metric: "follows_and_unfollows", period: "day", metric_type: "total_value", breakdown: "follow_type" }));
await probe("follower_demographics age", q(`${IG}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "age" }));
await probe("follower_demographics city", q(`${IG}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "city" }));
console.log("  -- deprecated (expect errors): --");
await probe("profile_views (OLD)", q(`${IG}/insights`, { metric: "profile_views", period: "day" }));
await probe("audience_gender_age (OLD)", q(`${IG}/insights`, { metric: "audience_gender_age", period: "lifetime" }));

console.log("\n=== INSTAGRAM — recent media (native-sweep test) ===");
const media = await (await fetch(q(`${IG}/media`, { fields: "id,media_type,media_product_type,timestamp", limit: "5" }))).json();
if (media.error) {
  console.log("  ✗ media list ERROR:", media.error.message);
} else {
  const items = media.data ?? [];
  console.log(`  ✓ pulled ${items.length} recent media (sweep works)`);
  for (const m of items.slice(0, 3)) console.log(`      ${m.media_product_type}/${m.media_type}  ${m.timestamp?.slice(0, 10)}  ${m.id}`);
  const latest = items[0];
  if (latest) {
    console.log(`  -- insights on latest (${latest.media_product_type}/${latest.media_type}) --`);
    await probe("reach,likes,comments,saved,shares", q(`${latest.id}/insights`, { metric: "reach,likes,comments,saved,shares" }));
    await probe("views", q(`${latest.id}/insights`, { metric: "views" }));
    if (latest.media_product_type === "REELS") {
      await probe("ig_reels_avg_watch_time", q(`${latest.id}/insights`, { metric: "ig_reels_avg_watch_time" }));
      await probe("ig_reels_video_view_total_time", q(`${latest.id}/insights`, { metric: "ig_reels_video_view_total_time" }));
    }
    await probe("impressions (OLD)", q(`${latest.id}/insights`, { metric: "impressions" }));
  }
}

console.log("\n=== FACEBOOK — page level ===");
await probe("followers_count / fan_count", q(PAGE, { fields: "followers_count,fan_count,name" }));
await probe("page_impressions_unique (week)", q(`${PAGE}/insights`, { metric: "page_impressions_unique", period: "week" }));
await probe("page_post_engagements (week)", q(`${PAGE}/insights`, { metric: "page_post_engagements", period: "week" }));
await probe("page_fan_adds (week)", q(`${PAGE}/insights`, { metric: "page_fan_adds", period: "week" }));
console.log("  -- deprecated (expect errors): --");
await probe("page_fans_city (OLD demo)", q(`${PAGE}/insights`, { metric: "page_fans_city", period: "lifetime" }));
await probe("page_fans_gender_age (OLD demo)", q(`${PAGE}/insights`, { metric: "page_fans_gender_age", period: "lifetime" }));

console.log("\n=== FACEBOOK — recent posts (native-sweep test) ===");
const posts = await (await fetch(q(`${PAGE}/posts`, { fields: "id,created_time", limit: "5" }))).json();
if (posts.error) {
  console.log("  ✗ posts list ERROR:", posts.error.message);
} else {
  const items = posts.data ?? [];
  console.log(`  ✓ pulled ${items.length} recent FB posts`);
  const latest = items[0];
  if (latest) {
    await probe("post reach/engagement", q(`${latest.id}/insights`, { metric: "post_impressions_unique,post_clicks" }));
    await probe("post_reactions_by_type_total", q(`${latest.id}/insights`, { metric: "post_reactions_by_type_total" }));
  }
}

console.log("\nDone — read-only, nothing posted.\n");
