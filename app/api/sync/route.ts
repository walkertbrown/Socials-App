import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrNull } from "@/lib/auth/require-user";
import { listImagesRecursive } from "@/lib/drive/list-new-files";
import { insertPlaceholders, getProcessingIds } from "@/lib/db/photos";

export const runtime = "nodejs";
export const maxDuration = 60;

// Lists new Drive files and inserts placeholder rows. Does NOT do the heavy
// per-photo work — it returns the ids the client should then process one by one.
export async function POST() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json({ error: "DRIVE_FOLDER_ID is not set" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: run } = await admin
    .from("import_runs")
    .insert({ files_seen: 0, files_new: 0 })
    .select("id")
    .single();

  const images = await listImagesRecursive(folderId);
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
  return NextResponse.json({ filesSeen: images.length, filesNew, processingIds });
}
