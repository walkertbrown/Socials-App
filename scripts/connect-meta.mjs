// Exchange a short-lived Page token for a long-lived one, look up the linked
// Instagram Business account id, and store both + the Page id into the singleton
// meta_credentials row the app reads. Keeps the token out of the terminal/chat.
//
// Usage: node --env-file=.env.local scripts/connect-meta.mjs <PAGE_ID> <SHORT_PAGE_TOKEN>
import { createClient } from "@supabase/supabase-js";

const [pageId, shortToken] = process.argv.slice(2);
const appId = process.env.META_APP_ID;
const appSecret = process.env.META_APP_SECRET;
const GRAPH = "https://graph.facebook.com/v25.0";

if (!pageId || !shortToken) {
  console.error("usage: node --env-file=.env.local scripts/connect-meta.mjs <PAGE_ID> <PAGE_TOKEN>");
  process.exit(1);
}
if (!appId || !appSecret) {
  console.error("Missing META_APP_ID / META_APP_SECRET in .env.local");
  process.exit(1);
}

// 1. Short-lived Page token -> long-lived token.
const exchUrl =
  `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
  `&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
const exch = await (await fetch(exchUrl)).json();
if (exch.error) {
  console.error("Token exchange failed:", exch.error.message);
  process.exit(1);
}
const longToken = exch.access_token;
const expiresIn = exch.expires_in ? Number(exch.expires_in) : null;

// 2. Linked Instagram Business account id.
const igUrl = `${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(longToken)}`;
const ig = await (await fetch(igUrl)).json();
if (ig.error) {
  console.error("Instagram lookup failed:", ig.error.message);
  process.exit(1);
}
const igId = ig.instagram_business_account?.id ?? null;

// 3. Store into meta_credentials (singleton id=1).
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const expiresAt = expiresIn
  ? new Date(Date.now() + expiresIn * 1000).toISOString()
  : new Date(Date.now() + 60 * 86400 * 1000).toISOString();

const { error } = await sb
  .from("meta_credentials")
  .upsert(
    { id: 1, page_id: pageId, ig_user_id: igId, page_token: longToken, token_expires_at: expiresAt },
    { onConflict: "id" }
  );
if (error) {
  if (/relation .*meta_credentials.* does not exist/i.test(error.message)) {
    console.error("meta_credentials table not found — apply migration 0003_scheduling.sql first.");
  } else {
    console.error("DB write failed:", error.message);
  }
  process.exit(1);
}

console.log("Connected to Meta and stored credentials:");
console.log("  Page ID    :", pageId);
console.log("  IG user ID :", igId ?? "(none — is the IG linked as a Business account?)");
console.log("  Token      : long-lived, length", longToken.length);
console.log("  Expires    :", expiresIn ? Math.round(expiresIn / 86400) + " days" : "~60 days (default)");
console.log("  Saved to meta_credentials row id=1.");
