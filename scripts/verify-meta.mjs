// READ-ONLY verification that the Meta connection is live. Confirms the stored
// token is valid, carries the publishing permissions, and can read the Page + IG.
// Publishes NOTHING. Run: node --env-file=.env.local scripts/verify-meta.mjs
import { createClient } from "@supabase/supabase-js";

const GRAPH = "https://graph.facebook.com/v25.0";
const appId = process.env.META_APP_ID;
const appSecret = process.env.META_APP_SECRET;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: c } = await sb
  .from("meta_credentials")
  .select("page_id, ig_user_id, page_token, token_expires_at")
  .eq("id", 1)
  .maybeSingle();
if (!c?.page_token) {
  console.error("No stored token found in meta_credentials.");
  process.exit(1);
}

const NEED = ["pages_manage_posts", "pages_read_engagement", "instagram_basic", "instagram_content_publish"];

// 1. Token debug — validity, scopes, expiry.
const dbg = await (
  await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(c.page_token)}&access_token=${appId}|${appSecret}`)
).json();
const d = dbg.data ?? {};
const scopes = d.scopes ?? [];
console.log("Token valid     :", d.is_valid === true ? "yes" : "NO");
console.log("Token type      :", d.type ?? "(unknown)");
const missing = NEED.filter((s) => !scopes.includes(s));
console.log("Publish scopes  :", missing.length === 0 ? "all present ✓" : "MISSING: " + missing.join(", "));

// 2. Read the Page (no write).
const page = await (await fetch(`${GRAPH}/${c.page_id}?fields=name,fan_count&access_token=${encodeURIComponent(c.page_token)}`)).json();
console.log("Facebook Page   :", page.error ? "ERROR: " + page.error.message : `${page.name} (${page.fan_count ?? "?"} followers)`);

// 3. Read the IG account (no write).
const ig = await (await fetch(`${GRAPH}/${c.ig_user_id}?fields=username,followers_count&access_token=${encodeURIComponent(c.page_token)}`)).json();
console.log("Instagram       :", ig.error ? "ERROR: " + ig.error.message : `@${ig.username} (${ig.followers_count ?? "?"} followers)`);

// 4. Expiry from our stored value.
const days = c.token_expires_at ? Math.round((new Date(c.token_expires_at).getTime() - Date.now()) / 86400000) : null;
console.log("Token expires   :", days != null ? days + " days" : "(unknown)");

console.log("\nNo posts were made — this was read-only.");
