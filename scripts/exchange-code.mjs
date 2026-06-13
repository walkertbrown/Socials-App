// Exchange an OAuth authorization code (or the full redirect URL) for a refresh token.
// Run: node --env-file=.env.local scripts/exchange-code.mjs '<code-or-redirect-url>'
import fs from "fs";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

let arg = process.argv[2] || "";
let code = arg.trim();
if (code.includes("code=")) {
  code = new URL(code).searchParams.get("code"); // auto-decodes
}
if (!code) { console.error("No code provided."); process.exit(1); }

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "http://localhost:4571");
try {
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error("Exchanged OK but no refresh_token returned (try the auth URL again).");
    process.exit(1);
  }
  fs.writeFileSync("/tmp/socials-refresh-token.txt", tokens.refresh_token, "utf8");
  console.log("SUCCESS — refresh token saved.");
} catch (e) {
  console.error("Exchange failed:", e.response?.data?.error_description || e.message);
  process.exit(1);
}
