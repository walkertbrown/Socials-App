import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrNull } from "@/lib/auth/require-user";
import { listObjects } from "@/lib/storage/objects";
import { insertMinioPlaceholders, getProcessingIds } from "@/lib/db/photos";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reads all objects in the MinIO bucket, inserts placeholder rows for any we
// haven't seen before (keyed on object_key), and returns the ids to process.
// Category is a DB field now — there's no Drive folder-to-category mapping step.
export async function POST() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();

  const { data: run } = await admin
    .from("import_runs")
    .insert({ files_seen: 0, files_new: 0 })
    .select("id")
    .single();

  // List every object in the bucket. The bucket holds only media files (the
  // rclone copy preserves filenames but doesn't include non-media objects).
  const objects = await listObjects("");

  // Only register image/video objects (skip any stray non-media keys).
  const mediaObjects = objects.filter((o) => isMediaKey(o.key));

  const filesNew = await insertMinioPlaceholders(
    mediaObjects.map((o) => ({
      key: o.key,
      // Use the filename portion of the key as the human-readable name.
      name: o.key.split("/").pop() ?? o.key,
    }))
  );

  if (run?.id) {
    await admin
      .from("import_runs")
      .update({
        finished_at: new Date().toISOString(),
        files_seen: mediaObjects.length,
        files_new: filesNew,
      })
      .eq("id", run.id);
  }

  const processingIds = await getProcessingIds();
  return NextResponse.json({
    filesSeen: mediaObjects.length,
    filesNew,
    processingIds,
  });
}

// Accept common image and video extensions by key suffix.
// This is a fast heuristic; the MinIO bucket should only contain media.
function isMediaKey(key: string): boolean {
  const lower = key.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|heic|heif|tiff?|bmp|mp4|mov|m4v|avi|mkv|webm)$/.test(
    lower
  );
}
