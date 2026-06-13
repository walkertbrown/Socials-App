import "server-only";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { fetchDriveFile } from "@/lib/drive/fetch-file";
import { renameFile } from "@/lib/drive/rename-file";

const MODEL = "claude-haiku-4-5";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300)))));
  });
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "video";
}

// A real extension is short + alphanumeric; otherwise default to mp4 (e.g. "grad story").
function extOf(name: string): string {
  const parts = name.split(".");
  const ext = parts.length > 1 ? (parts.pop() as string).toLowerCase() : "";
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "mp4";
}

// Best-effort: pull a few frames from a video, have Claude name it, rename in Drive.
// Needs ffmpeg on PATH — throws if it's unavailable, so callers treat naming as optional.
export async function describeAndRename(driveFileId: string, driveName: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const bytes = await fetchDriveFile(driveFileId);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vid-"));
  try {
    const ext = extOf(driveName);
    const vidPath = path.join(tmp, `in.${ext}`);
    await fs.writeFile(vidPath, bytes);

    await run(process.env.FFMPEG_PATH || "ffmpeg", [
      "-i", vidPath, "-vf", "thumbnail=n=50,scale=512:-1", "-frames:v", "3", "-y", path.join(tmp, "f%02d.jpg"),
    ]);

    const frameFiles = (await fs.readdir(tmp)).filter((f) => f.endsWith(".jpg")).slice(0, 3);
    if (!frameFiles.length) return null;
    const frames: Buffer[] = [];
    for (const f of frameFiles) frames.push(await fs.readFile(path.join(tmp, f)));

    const content = [
      ...frames.map((b) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/jpeg" as const, data: b.toString("base64") },
      })),
      { type: "text" as const, text: "Name this video." },
    ];

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 40,
      system:
        "These are still frames from a short video taken at a restaurant or bar. Reply with ONLY a short " +
        "descriptive name: 3-6 lowercase words separated by spaces, no punctuation, no file extension.",
      messages: [{ role: "user", content }],
    });

    const desc = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join(" ")
      .trim();
    const newName = `${slugify(desc)}.${ext}`;
    await renameFile(driveFileId, newName);
    return newName;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
