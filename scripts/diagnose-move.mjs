// Diagnostic: why can't the robot move the file? Prints ownership + capabilities.
// Run: node --env-file=.env.local scripts/diagnose-move.mjs
import { google } from "googleapis";

const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });
const dumpId = process.env.DRIVE_FOLDER_ID;

const list = await drive.files.list({
  q: `'${dumpId}' in parents and trashed = false`,
  fields: "files(id, name, mimeType)",
  pageSize: 5,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});
const img = (list.data.files || []).find((f) => (f.mimeType || "").startsWith("image/"));
console.log("Test file:", img?.name, img?.id);

const f = await drive.files.get({
  fileId: img.id,
  fields: "name, driveId, ownedByMe, owners(emailAddress), parents, capabilities",
  supportsAllDrives: true,
});
console.log("In a Shared Drive?:", f.data.driveId ? `yes (${f.data.driveId})` : "no — personal My Drive");
console.log("ownedByMe (robot owns it?):", f.data.ownedByMe);
console.log("owner:", JSON.stringify(f.data.owners));
console.log("parents visible to robot:", JSON.stringify(f.data.parents));
console.log("capabilities:", JSON.stringify(f.data.capabilities, null, 2));

const folder = await drive.files.get({
  fileId: dumpId,
  fields: "name, driveId, capabilities(canEdit, canAddChildren, canRemoveChildren)",
  supportsAllDrives: true,
});
console.log("\nDump folder Shared Drive?:", folder.data.driveId ? "yes" : "no");
console.log("dump folder capabilities:", JSON.stringify(folder.data.capabilities, null, 2));
