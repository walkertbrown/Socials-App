import "server-only";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { getSignedDownloadUrl } from "@/lib/storage/objects";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300)))));
  });
}

// Grab ONE representative still frame from a MinIO video WITHOUT downloading the
// whole file: ffmpeg reads the video over HTTP (range requests via presigned URL)
// and seeks ~1s in. Returns the JPEG frame so the caller can also describe it
// without re-extracting.
export async function extractVideoFrame(objectKey: string): Promise<Buffer> {
  // Presigned URL lets ffmpeg range-read without needing auth headers.
  // TTL of 5 minutes is more than enough for ffmpeg to grab a single frame.
  const url = await getSignedDownloadUrl(objectKey, 300, undefined, true);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vthumb-"));
  const out = path.join(tmp, "frame.jpg");
  try {
    await run(process.env.FFMPEG_PATH || "ffmpeg", [
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

