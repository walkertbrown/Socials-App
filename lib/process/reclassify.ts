import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCategoryKey } from "@/lib/categories";

// Her correction: change a photo's category in the DB. MinIO has no folder structure
// so there is nothing to move — the category lives only in the photos table.
export async function reclassifyPhoto(photoId: string, category: string) {
  if (!isCategoryKey(category)) throw new Error("Unknown category");
  const supabase = createAdminClient();

  const { data: photo } = await supabase
    .from("photos")
    .select("id")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found");

  await supabase
    .from("photos")
    .update({
      category,
      tags: [category],
    })
    .eq("id", photoId);

  return { id: photoId, category };
}
