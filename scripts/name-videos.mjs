// Backfill: describe + rename the videos already swept into 05_Videos.
// For each: pull 3 frames with ffmpeg, ask Claude for a name, rename in Drive.
// Run: node --env-file=.env.local scripts/name-videos.mjs
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const auth = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
const drive = google.drive({ version: "v3", auth });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(err.slice(-300)))));
  });
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "video";
}

const { data: videos } = await sb.from("photos").select("drive_file_id, drive_name").eq("category", "videos");
console.log("Videos to name:", videos.length);

for (const v of videos) {
  let tmp;
  try {
    const dl = await drive.files.get({ fileId: v.drive_file_id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vid-"));
    const ext = (v.drive_name.split(".").pop() || "mp4").toLowerCase();
    const vidPath = path.join(tmp, "in." + ext);
    await fs.writeFile(vidPath, Buffer.from(dl.data));

    await run("ffmpeg", ["-i", vidPath, "-vf", "thumbnail=n=50,scale=512:-1", "-frames:v", "3", "-y", path.join(tmp, "f%02d.jpg")]);
    const frames = (await fs.readdir(tmp)).filter((f) => f.endsWith(".jpg")).slice(0, 3);
    if (!frames.length) { console.log(`- ${v.drive_name}: no frames, skipped`); continue; }

    const images = [];
    for (const f of frames) {
      const b = await fs.readFile(path.join(tmp, f));
      images.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b.toString("base64") } });
    }
    const m = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 40,
      system:
        "These are still frames from a short video taken at a restaurant or bar. Reply with ONLY a short descriptive name: 3-6 lowercase words separated by spaces, no punctuation, no file extension. Describe what's happening, e.g. 'bartender shaking a cocktail' or 'busy dining room at night'.",
      messages: [{ role: "user", content: [...images, { type: "text", text: "Name this video." }] }],
    });
    const desc = m.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    const newName = `${slugify(desc)}.${ext}`;
    await drive.files.update({ fileId: v.drive_file_id, requestBody: { name: newName }, supportsAllDrives: true });
    console.log(`- ${v.drive_name}  ->  ${newName}`);
  } catch (e) {
    console.log(`- ${v.drive_name}: ERROR ${e.message}`);
  } finally {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
console.log("Done.");
