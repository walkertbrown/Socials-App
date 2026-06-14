import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "graphics";

// Uploads a PNG buffer to the public 'graphics' bucket and returns
// { url, path }. Called ONLY on an explicit Save — preview renders never touch
// this function (cost-watchdog guard: no storage writes on preview).
export async function storeGraphicPng(
  pngBuffer: Buffer,
  graphicId: string,
  size: "feed" | "story"
): Promise<{ url: string; path: string }> {
  const sb = createAdminClient();
  const path = `${graphicId}-${size}-${Date.now()}.png`;

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, pngBuffer, { contentType: "image/png", upsert: false });

  if (error) throw new Error(`Graphic storage failed: ${error.message}`);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
