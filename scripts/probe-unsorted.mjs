// Identify the UNSORTED folder + the mystery subfolder inside it: names, owners,
// my access level, and whether I can actually read the subfolder's contents.
// Run: node --env-file=.env.local scripts/probe-unsorted.mjs
import { google } from "googleapis";

const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
const drive = google.drive({ version: "v3", auth });

const FIELDS = "id, name, mimeType, owners(emailAddress), capabilities(canListChildren,canEdit), shared";

async function meta(id) {
  const r = await drive.files.get({ fileId: id, fields: FIELDS, supportsAllDrives: true });
  return r.data;
}

const unsortedId = process.env.DRIVE_UNSORTED_FOLDER_ID;
const u = await meta(unsortedId);
console.log("UNSORTED folder:");
console.log(`  name: ${u.name}`);
console.log(`  owner: ${u.owners?.[0]?.emailAddress}  shared:${u.shared}  canList:${u.capabilities?.canListChildren} canEdit:${u.capabilities?.canEdit}\n`);

const kids = await drive.files.list({
  q: `'${unsortedId}' in parents and trashed = false`,
  fields: "files(id, name, mimeType, owners(emailAddress), capabilities(canListChildren,canEdit))",
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});

for (const f of kids.data.files ?? []) {
  const isFolder = f.mimeType === "application/vnd.google-apps.folder";
  console.log(`child: ${f.name}  [${isFolder ? "FOLDER" : f.mimeType}]`);
  console.log(`  owner: ${f.owners?.[0]?.emailAddress}  canList:${f.capabilities?.canListChildren} canEdit:${f.capabilities?.canEdit}`);
  if (isFolder) {
    const inside = await drive.files.list({
      q: `'${f.id}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, owners(emailAddress))",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const list = inside.data.files ?? [];
    console.log(`  -> ${list.length} items inside`);
    const owners = {};
    for (const x of list) owners[x.owners?.[0]?.emailAddress ?? "?"] = (owners[x.owners?.[0]?.emailAddress ?? "?"] ?? 0) + 1;
    if (list.length) {
      console.log(`     owners:`, JSON.stringify(owners));
      for (const x of list.slice(0, 10)) console.log(`     - ${x.name} [${x.mimeType}]`);
      if (list.length > 10) console.log(`     …and ${list.length - 10} more`);
    }
  }
  console.log("");
}
