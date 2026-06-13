import "server-only";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { getDriveAccessToken, driveMediaUrl } from "@/lib/drive/download-url";
import { storeThumbnail } from "@/lib/process/make-thumbnail";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300)))));
  });
}

// Grab ONE representative still frame from a Drive video WITHOUT downloading the
// whole file: ffmpeg reads the video over HTTP (range requests) and seeks ~1s in.
// Returns the JPEG frame so the caller can also describe it without re-extracting.
export async function extractVideoFrame(driveFileId: string): Promise<Buffer> {
  const token = await getDriveAccessToken();
  const url = driveMediaUrl(driveFileId);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vthumb-"));
  const out = path.join(tmp, "frame.jpg");
  try {
    await run(process.env.FFMPEG_PATH || "ffmpeg", [
      "-headers", `Authorization: Bearer ${token}\r\n`,
      "-ss", "1", // seek ~1s in for a non-black frame (input seek = minimal bytes read)
      "-i", url,
      "-frames:v", "1",
      "-vf", "scale=1000:-1",
      "-y", out,
    ]);
    return await fs.readFile(out);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// Extract a frame and store it as the video's thumbnail. Returns the stored path
// and the frame buffer (for describing/tagging in the same pass).
export async function makeVideoThumbnail(
  driveFileId: string
): Promise<{ path: string; frame: Buffer }> {
  const frame = await extractVideoFrame(driveFileId);
  const path = await storeThumbnail(driveFileId, frame);
  return { path, frame };
}
