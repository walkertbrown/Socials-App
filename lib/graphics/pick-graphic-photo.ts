import "server-only";
import { getTextSafePhotos } from "@/lib/db/photos";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns a public thumbnail URL for a text_safe photo, given its id.
// Used by the render layer to pass a real image URL to Browserless.
export async function getPhotoUrlForGraphic(photoId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("photos")
    .select("thumbnail_path")
    .eq("id", photoId)
    .eq("text_safe", true)
    .maybeSingle();
  if (!data?.thumbnail_path) return null;

  // Thumbnails live in the private 'thumbnails' bucket — get a 1-hour signed URL
  // so Browserless can fetch it at render time without public exposure.
  const { data: signed } = await sb.storage
    .from("thumbnails")
    .createSignedUrl(data.thumbnail_path, 3600);

  return signed?.signedUrl ?? null;
}

// Returns ids of all text_safe photos — passed to the AI so it can pick
// one by id from a known-valid list (no hallucinated ids reach the renderer).
export async function getTextSafePhotoIds(): Promise<string[]> {
  const photos = await getTextSafePhotos();
  return photos.map((p) => p.id);
}
