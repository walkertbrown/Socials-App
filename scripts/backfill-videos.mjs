// One-time backfill for existing videos: grab a still frame (streamed from Drive,
// no full download), store it as a thumbnail, and AI-describe+tag it so videos are
// selectable + searchable. Safe to re-run — only does videos missing a thumbnail.
// Run: node --env-file=.env.local scripts/backfill-videos.mjs
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5";

const FEATURE_TAGS = [
  "staff", "food", "dessert", "cocktail", "wine", "dining room", "bar", "patio",
  "exterior", "event", "crowd", "live music", "holiday", "group", "portrait", "seafood",
];
const SYSTEM =
  "This is a still frame from a short video at a New Orleans restaurant. Return ONLY a JSON object " +
  "with keys: description, tags.\n" +
  "description = 1–2 short, plain sentences describing ONLY what is literally visible. Be concrete. " +
  "Do NOT guess people's names, event names, or menu-item names you can't be sure of.\n" +
  `tags = a JSON array of lowercase tags. Include any of these that apply: ${FEATURE_TAGS.join(", ")}. ` +
  "Then add up to 3 specific visible keywords. Always include 'video'. Never invent a person's name.";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300)))));
  });
}

async function accessToken() {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  const { token } = await auth.getAccessToken();
  return token;
}
const mediaUrl = (id) => `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;

function parse(text) {
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s === -1 || e <= s) return null;
    const obj = JSON.parse(text.slice(s, e + 1));
    const description = typeof obj.description === "string" ? obj.description.trim() : "";
    let tags = Array.isArray(obj.tags)
      ? obj.tags.map((t) => String(t).toLowerCase().trim()).filter((t) => t && t.length < 40)
      : [];
    if (!tags.includes("video")) tags.push("video");
    tags = Array.from(new Set(tags)).slice(0, 12);
    return { description, tags };
  } catch {
    return null;
  }
}

const { data: vids, error } = await sb
  .from("photos")
  .select("id, drive_file_id, thumbnail_path")
  .eq("status", "ready")
  .eq("category", "videos");
if (error) { console.error(error.message); process.exit(1); }

const todo = vids.filter((v) => !v.thumbnail_path);
console.log(`${vids.length} videos; ${todo.length} need a thumbnail.`);

const token = await accessToken();
let done = 0, failed = 0;
for (const v of todo) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vbf-"));
  const out = path.join(tmp, "frame.jpg");
  try {
    await run(process.env.FFMPEG_PATH || "ffmpeg", [
      "-headers", `Authorization: Bearer ${token}\r\n`,
      "-ss", "1", "-i", mediaUrl(v.drive_file_id),
      "-frames:v", "1", "-vf", "scale=1000:-1", "-y", out,
    ]);
    const frame = await fs.readFile(out);

    const thumbPath = `${v.drive_file_id}.jpg`;
    const up = await sb.storage.from("thumbnails").upload(thumbPath, frame, {
      contentType: "image/jpeg", upsert: true,
    });
    if (up.error) throw new Error(up.error.message);

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame.toString("base64") } },
          { type: "text", text: "Describe this video frame. Return only the JSON object." },
        ],
      }],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
    const a = parse(text) || { description: "", tags: ["video"] };

    const { error: upErr } = await sb
      .from("photos")
      .update({ thumbnail_path: thumbPath, description: a.description, tags: a.tags })
      .eq("id", v.id);
    if (upErr) throw new Error(upErr.message);

    done++;
    console.log(`✓ ${done}/${todo.length}  ${a.tags.join(", ")}  — ${a.description.slice(0, 50)}`);
  } catch (e) {
    failed++;
    console.warn(`✗ ${v.drive_file_id}: ${e.message}`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
console.log(`\nDone. Thumbnailed ${done}, failed ${failed}.`);
