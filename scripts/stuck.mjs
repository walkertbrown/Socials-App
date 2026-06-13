// Inspect the photos stuck in "processing": name, type, size. Reveals why they choked.
// Run: node --env-file=.env.local scripts/stuck.mjs
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data } = await sb.from("photos").select("drive_file_id, drive_name").eq("status", "processing");
console.log("Stuck in processing:", data.length);

const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
const drive = google.drive({ version: "v3", auth });

for (const p of data) {
  try {
    const f = await drive.files.get({ fileId: p.drive_file_id, fields: "name, mimeType, size", supportsAllDrives: true });
    const mb = f.data.size ? (Number(f.data.size) / 1048576).toFixed(1) + "MB" : "?";
    console.log(`- ${f.data.name}  |  ${f.data.mimeType}  |  ${mb}`);
  } catch (e) {
    console.log(`- ${p.drive_name}  |  metadata error: ${e.message}`);
  }
}
