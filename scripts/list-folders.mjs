// Inspect what's actually sitting in the dump + unsorted folders right now, with
// owners + types, and cross-check against the DB (what's been ingested).
// Run: node --env-file=.env.local scripts/list-folders.mjs
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
const drive = google.drive({ version: "v3", auth });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const about = await drive.about.get({ fields: "user(emailAddress)" });
console.log("Acting as:", about.data.user?.emailAddress, "\n");

const { data: rows } = await sb.from("photos").select("drive_file_id");
const known = new Set((rows ?? []).map((r) => r.drive_file_id));

async function listFolder(label, folderId) {
  console.log(`=== ${label} (${folderId}) ===`);
  const queue = [folderId];
  const seen = new Set();
  let files = 0, folders = 0, images = 0, videos = 0, other = 0, inDb = 0, notInDb = 0;
  const ownerCount = {};
  const notIngested = [];
  while (queue.length) {
    const cur = queue.shift();
    if (seen.has(cur)) continue;
    seen.add(cur);
    let pageToken;
    do {
      const res = await drive.files.list({
        q: `'${cur}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, owners(emailAddress))",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of res.data.files ?? []) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          folders++;
          queue.push(f.id);
          continue;
        }
        files++;
        const owner = f.owners?.[0]?.emailAddress ?? "(unknown)";
        ownerCount[owner] = (ownerCount[owner] ?? 0) + 1;
        if (f.mimeType?.startsWith("image/")) images++;
        else if (f.mimeType?.startsWith("video/")) videos++;
        else other++;
        if (known.has(f.id)) inDb++;
        else {
          notInDb++;
          if ((f.mimeType?.startsWith("image/") || f.mimeType?.startsWith("video/")))
            notIngested.push(`${f.name}  [${f.mimeType}]  owner:${owner}`);
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  console.log(`subfolders:${folders} files:${files} (images:${images} videos:${videos} other:${other})`);
  console.log(`already in DB:${inDb}  NOT in DB:${notInDb}`);
  console.log(`owners:`, JSON.stringify(ownerCount));
  if (notIngested.length) {
    console.log(`-- image/video files NOT yet ingested (${notIngested.length}):`);
    for (const n of notIngested.slice(0, 50)) console.log("   " + n);
    if (notIngested.length > 50) console.log(`   …and ${notIngested.length - 50} more`);
  }
  console.log("");
}

await listFolder("DUMP", process.env.DRIVE_FOLDER_ID);
await listFolder("UNSORTED", process.env.DRIVE_UNSORTED_FOLDER_ID);
