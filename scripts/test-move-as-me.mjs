// Verify: can the app, signed in AS the owner (your gcloud login), move a dump photo?
// Prereq: gcloud auth application-default login --scopes=...drive...
// Run: node --env-file=.env.local scripts/test-move-as-me.mjs
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const CATEGORIES = [
  { key: "food_drink", match: /food|drink/i },
  { key: "behind_scenes", match: /behind/i },
  { key: "events", match: /event/i },
  { key: "atmosphere", match: /atmosphere|atmos/i },
  { key: "unsorted", match: /unsorted/i },
];

// Application Default Credentials from `gcloud auth application-default login` — acts AS you.
const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive"] });
const drive = google.drive({ version: "v3", auth });
const dumpId = process.env.DRIVE_FOLDER_ID;
const unsortedId = process.env.DRIVE_UNSORTED_FOLDER_ID;

const about = await drive.about.get({ fields: "user(emailAddress)" });
console.log("Acting as:", about.data.user?.emailAddress);

const meta = await drive.files.get({ fileId: unsortedId, fields: "parents", supportsAllDrives: true });
const libraryId = meta.data.parents?.[0];
const sub = await drive.files.list({
  q: `'${libraryId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  fields: "files(id, name)",
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});
const folderId = {};
const folderName = {};
for (const f of sub.data.files || []) {
  const cat = CATEGORIES.find((c) => f.name && c.match.test(f.name));
  if (cat) { folderId[cat.key] = f.id; folderName[cat.key] = f.name; }
}

const list = await drive.files.list({
  q: `'${dumpId}' in parents and trashed = false`,
  fields: "files(id, name, mimeType, parents)",
  pageSize: 25,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});
const img = (list.data.files || []).find((f) => (f.mimeType || "").startsWith("image/"));
if (!img) { console.log("No images in the dump."); process.exit(0); }
console.log("Test photo:", img.name, "| parents visible now:", JSON.stringify(img.parents));

const dl = await drive.files.get({ fileId: img.id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
const thumb = await sharp(Buffer.from(dl.data)).rotate().resize(1000, 1000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const m = await anthropic.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 16,
  system: "You sort a restaurant's social-media photos into one category. Reply with exactly one of: food_drink, behind_scenes, events, atmosphere. If none clearly fits, reply: unsorted.",
  messages: [{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: thumb.toString("base64") } },
    { type: "text", text: "Which single category key best fits this photo?" },
  ] }],
});
const text = m.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").toLowerCase();
const category = (text.match(/food_drink|behind_scenes|events|atmosphere|unsorted/) || ["unsorted"])[0];
console.log("Categorized as:", category, "→", folderName[category]);

const dest = folderId[category];
const src = (img.parents && img.parents[0]) || dumpId;
try {
  await drive.files.update({ fileId: img.id, addParents: dest, removeParents: src, fields: "id", supportsAllDrives: true });
  console.log(`✅ MOVE WORKS AS OWNER — "${img.name}" → "${folderName[category]}"`);
  await drive.files.update({ fileId: img.id, addParents: dumpId, removeParents: dest, fields: "id", supportsAllDrives: true });
  console.log("↩️  Moved it back to the dump.");
} catch (e) {
  console.log("❌ Still blocked:", e.message);
}
