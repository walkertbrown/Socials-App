// One-time: authorize the app to act as you on Google Drive, and print a refresh token.
// Run: node --env-file=.env.local scripts/get-token.mjs
import http from "http";
import fs from "fs";
import { google } from "googleapis";
import { exec } from "child_process";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const PORT = 4571;
const REDIRECT = `http://localhost:${PORT}`;
const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
});

const server = http.createServer(async (req, res) => {
  try {
    const code = new URL(req.url, REDIRECT).searchParams.get("code");
    if (!code) { res.end("No code received."); return; }
    res.end("Success! Close this tab and return to the terminal.");
    const { tokens } = await oauth2.getToken(code);
    fs.writeFileSync("/tmp/socials-refresh-token.txt", tokens.refresh_token || "", "utf8");
    console.log("\n================ SUCCESS ================");
    console.log("Token saved. You can close the terminal and tell Claude it's done.");
    console.log("=========================================\n");
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT, () => {
  console.log("\nA browser will open. Sign in as walkertbrown@gmail.com and click Allow.");
  console.log('If it warns the app is unverified: Advanced -> "Go to Socials Sorter (unsafe)" -> Allow.\n');
  console.log("If the browser does not open, paste this URL into it:\n" + authUrl + "\n");
  exec(`open "${authUrl}"`);
});
