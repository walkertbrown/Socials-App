// Pre-flight check for the integrations, using .env.local.
// Run: node --env-file=.env.local scripts/check-setup.mjs
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const ok = (m) => console.log("✅ " + m);
const fail = (m, e) => console.log("❌ " + m + (e ? " — " + (e.message || e) : ""));

const folderId = process.env.DRIVE_FOLDER_ID;
let drive = null;
let firstImage = null;

// 1. Google Drive — can the robot actually see the folder?
try {
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  drive = google.drive({ version: "v3", auth });
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files || [];
  const images = files.filter((f) => (f.mimeType || "").startsWith("image/"));
  firstImage = images[0] || null;
  ok(`Google Drive: reached the folder — ${files.length} items, ${images.length} images.`);
  if (images.length) console.log("   e.g. " + images.slice(0, 5).map((f) => f.name).join(", "));
} catch (e) {
  fail("Google Drive", e);
}

// 2. Supabase — can we reach the database with the service key?
try {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { count, error } = await sb.from("photos").select("*", { count: "exact", head: true });
  if (error) throw error;
  ok(`Supabase: connected — photos table has ${count ?? 0} rows.`);
} catch (e) {
  fail("Supabase", e);
}

// 3. Anthropic — does the key (and billing) work?
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
try {
  const m = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8,
    messages: [{ role: "user", content: "Reply with the single word: ready" }],
  });
  const t = m.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  ok(`Anthropic: key works — model replied "${t}".`);
} catch (e) {
  fail("Anthropic", e);
}

// 4. Full pipeline — download a real photo, thumbnail it, tag it.
try {
  if (!firstImage || !drive) throw new Error("skipped (no image from Drive)");
  const dl = await drive.files.get(
    { fileId: firstImage.id, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  const thumb = await sharp(Buffer.from(dl.data))
    .rotate()
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
  const m = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 16,
    system:
      "You label restaurant photos. Reply with one word: food, drink, people, exterior, interior, or other.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: thumb.toString("base64") } },
          { type: "text", text: "Which single label best fits this photo?" },
        ],
      },
    ],
  });
  const t = m.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  ok(`Full pipeline: downloaded + thumbnailed + tagged "${firstImage.name}" → ${t}`);
} catch (e) {
  fail("Full pipeline (image tag)", e);
}

console.log("\nDone.");
