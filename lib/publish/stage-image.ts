import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObjectBytes } from "@/lib/storage/objects";
import { toPostJpeg } from "@/lib/process/make-thumbnail";

const BUCKET = "post-images";
const GRAPHICS_BUCKET = "graphics";

// Returns a public URL for the post-ready image Meta will fetch.
// Fast path: if a pre-generated 2048px copy exists in 'post-ready', return its
// public URL directly — no MinIO download, no conversion, no temp file.
// Slow fallback: download the full original from MinIO, convert, stage in
// 'post-images', and return { url, path } so the caller can clean up afterward.
export async function stageImage(
  objectKey: string,
  postReadyPath?: string | null
): Promise<{ url: string; path: string | null }> {
  const sb = createAdminClient();

  if (postReadyPath) {
    const { data } = sb.storage.from("post-ready").getPublicUrl(postReadyPath);
    return { url: data.publicUrl, path: null };
  }

  const original = await getObjectBytes(objectKey);
  const jpeg = await toPostJpeg(original);

  // Timestamp-suffixed key so concurrent posts never collide.
  const path = `${objectKey.replace(/\//g, "-")}-${Date.now()}.jpg`;
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Image staging failed: ${error.message}`);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// Returns the public URL for a graphic already in the 'graphics' bucket.
// Unlike stageImage, graphics are already public and require no staging copy —
// we return the URL directly and set path to null to signal no cleanup needed.
export async function stageGraphic(
  pngPath: string
): Promise<{ url: string; path: null }> {
  const sb = createAdminClient();
  const { data } = sb.storage.from(GRAPHICS_BUCKET).getPublicUrl(pngPath);
  return { url: data.publicUrl, path: null };
}
