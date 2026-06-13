import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrNull } from "@/lib/auth/require-user";
import { listImagesRecursive } from "@/lib/drive/list-new-files";
import { getCategoryFolderMap } from "@/lib/drive/find-category-folders";
import { insertPlaceholders, getProcessingIds } from "@/lib/db/photos";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reads the two "needs to sort" folders (dump + unsorted), refreshes the
// destination folder map, inserts placeholders, and returns the ids to process.
export async function POST() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const dumpId = process.env.DRIVE_FOLDER_ID;
  const unsortedId = process.env.DRIVE_UNSORTED_FOLDER_ID;
  if (!dumpId || !unsortedId) {
    return NextResponse.json(
      { error: "DRIVE_FOLDER_ID and DRIVE_UNSORTED_FOLDER_ID must be set" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Refresh the category -> destination folder map (derived from the library).
  let folderMap: Record<string, string> = {};
  try {
    folderMap = await getCategoryFolderMap(unsortedId);
    await admin.from("app_config").update({ category_folder_map: folderMap }).eq("id", 1);
  } catch {
    // If the library can't be read yet, processing simply won't move files.
  }

  const { data: run } = await admin
    .from("import_runs")
    .insert({ files_seen: 0, files_new: 0 })
    .select("id")
    .single();

  const images = [
    ...(await listImagesRecursive(dumpId)),
    ...(await listImagesRecursive(unsortedId)),
  ];
  const filesNew = await insertPlaceholders(
    images.map((i) => ({ id: i.id, name: i.name }))
  );

  if (run?.id) {
    await admin
      .from("import_runs")
      .update({
        finished_at: new Date().toISOString(),
        files_seen: images.length,
        files_new: filesNew,
      })
      .eq("id", run.id);
  }

  const processingIds = await getProcessingIds();
  return NextResponse.json({
    filesSeen: images.length,
    filesNew,
    processingIds,
    categories: Object.keys(folderMap),
  });
}
