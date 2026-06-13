import "server-only";
import { Readable } from "stream";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDriveClient } from "@/lib/drive/client";

const BUCKET = "post-videos";
// CapCut clips are typically 20–80 MB; reject anything larger so we don't OOM
// the server. (Buffered fallback — see comment below.)
const MAX_VIDEO_BYTES = 150 * 1024 * 1024; // 150 MB

// Stages a video from Drive into the public post-videos bucket so Meta can
// fetch it via URL (both IG Reels and FB Reels accept a public video_url /
// file_url rather than requiring a multipart upload).
//
// TRADEOFF: Supabase's JS client Storage upload API does not support streaming
// uploads (it expects a Blob/Buffer/File, not a Node Readable). A true
// streamed pipe to Supabase Storage would require constructing a raw multipart
// HTTP request manually, which is fragile and untested.
//
// Acceptable fallback (per plan): buffer the Drive stream, reject files >150 MB
// with a clear user message, and comment the tradeoff here.
export async function stageVideo(
  driveFileId: string
): Promise<{ url: string; path: string }> {
  const drive = createDriveClient();

  // Stream from Drive into a buffer, bailing out if we exceed the size guard.
  const res = await drive.files.get(
    { fileId: driveFileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  const stream = res.data as Readable;

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_VIDEO_BYTES) {
        stream.destroy();
        reject(
          new Error(
            `Video is too large to auto-publish (${Math.round(totalBytes / 1024 / 1024)} MB). ` +
              "Please trim it below 150 MB, or use the 'Remind me' option."
          )
        );
        return;
      }
      chunks.push(chunk);
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  const buffer = Buffer.concat(chunks);
  const path = `${driveFileId}-${Date.now()}.mp4`;

  const sb = createAdminClient();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`Video staging failed: ${error.message}`);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
