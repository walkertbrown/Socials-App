import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDriveFile } from "@/lib/drive/fetch-file";
import { toPostJpeg } from "@/lib/process/make-thumbnail";

const BUCKET = "post-images";

// Pulls the full-res original from Drive, converts it to a clean JPEG, and puts
// it in the PUBLIC bucket so Meta can fetch it. Returns { url, path }; the caller
// MUST delete `path` afterward (see cleanup-image).
export async function stageImage(driveFileId: string): Promise<{ url: string; path: string }> {
  const original = await fetchDriveFile(driveFileId);
  const jpeg = await toPostJpeg(original);

  const path = `${driveFileId}-${Date.now()}.jpg`;
  const sb = createAdminClient();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Image staging failed: ${error.message}`);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
