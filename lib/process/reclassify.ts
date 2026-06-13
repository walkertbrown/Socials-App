import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveFile } from "@/lib/drive/move-file";
import { isCategoryKey } from "@/lib/categories";

// Her correction: change a photo's category and move the file to match.
export async function reclassifyPhoto(photoId: string, category: string) {
  if (!isCategoryKey(category)) throw new Error("Unknown category");
  const supabase = createAdminClient();

  const { data: photo } = await supabase
    .from("photos")
    .select("drive_file_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found");

  const { data: config } = await supabase
    .from("app_config")
    .select("category_folder_map")
    .eq("id", 1)
    .maybeSingle();
  const dest = (config?.category_folder_map ?? {})[category] as string | undefined;

  let currentFolderId: string | null = null;
  if (dest) {
    await moveFile(photo.drive_file_id, dest);
    currentFolderId = dest;
  }

  await supabase
    .from("photos")
    .update({
      category,
      current_folder_id: currentFolderId,
      moved_at: currentFolderId ? new Date().toISOString() : null,
      tags: [category],
    })
    .eq("id", photoId);

  return { id: photoId, category, moved: !!currentFolderId };
}
