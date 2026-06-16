import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObjectBytes } from "@/lib/storage/objects";

const BUCKET = "post-videos";
// CapCut clips are typically 20–80 MB; reject anything larger so we don't OOM
// the server. (Buffered — see comment below.)
const MAX_VIDEO_BYTES = 150 * 1024 * 1024; // 150 MB

// Stages a video from MinIO into the public post-videos bucket so Meta can
// fetch it via URL (both IG Reels and FB Reels accept a public video_url /
// file_url rather than requiring a multipart upload).
//
// TRADEOFF: Supabase's JS client Storage upload API does not support streaming
// uploads (it expects a Blob/Buffer/File, not a Node Readable). A true
// streamed pipe to Supabase Storage would require constructing a raw multipart
// HTTP request manually, which is fragile and untested.
//
// Acceptable fallback (per plan): buffer the MinIO object, reject files >150 MB
// with a clear user message, and comment the tradeoff here.
export async function stageVideo(
  objectKey: string
): Promise<{ url: string; path: string }> {
  const buffer = await getObjectBytes(objectKey);

  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is too large to auto-publish (${Math.round(buffer.length / 1024 / 1024)} MB). ` +
        "Please trim it below 150 MB, or use the 'Remind me' option."
    );
  }

  // Use a timestamp-suffixed key so concurrent posts never collide.
  const path = `${objectKey.replace(/\//g, "-")}-${Date.now()}.mp4`;

  const sb = createAdminClient();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`Video staging failed: ${error.message}`);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
