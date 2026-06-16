import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObjectBytes } from "@/lib/storage/objects";
import { toPostJpeg } from "@/lib/process/make-thumbnail";

const BUCKET = "post-images";
const GRAPHICS_BUCKET = "graphics";

// Pulls the full-res original from MinIO, converts it to a clean JPEG, and puts
// it in the PUBLIC bucket so Meta can fetch it. Returns { url, path }; the caller
// MUST delete `path` afterward (see cleanup-image).
export async function stageImage(objectKey: string): Promise<{ url: string; path: string }> {
  const original = await getObjectBytes(objectKey);
  const jpeg = await toPostJpeg(original);

  // Use a timestamp-suffixed key so concurrent posts never collide.
  const path = `${objectKey.replace(/\//g, "-")}-${Date.now()}.jpg`;
  const sb = createAdminClient();
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
