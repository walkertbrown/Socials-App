// Generate preview frames for the video rows that don't have one yet.
// The bulk ingest ran with the old (Drive-based) video code, so videos came in
// without thumbnails. This re-runs ONLY the video-frame step with the new MinIO
// code: ffmpeg range-reads a single frame from MinIO via a presigned URL, stores
// it as the thumbnail, and (best-effort) describes/tags it from that frame.
//
// Runs from a machine with ffmpeg (this Mac). Videos have no dedupe/ordering
// constraint, so we process several at once.
// Run: node --conditions=react-server --env-file=.env.local --import tsx scripts/redo-video-thumbs.mts
import { createAdminClient } from "@/lib/supabase/admin";
import { extractVideoFrame } from "@/lib/process/video-thumbnail";
import { storeThumbnail } from "@/lib/process/make-thumbnail";
import { analyzePhoto } from "@/lib/process/vision-tag";

const CONCURRENCY = 5;
const sb = createAdminClient();

const { data: vids, error } = await sb
  .from("photos")
  .select("id, object_key")
  .eq("category", "videos")
  .is("thumbnail_path", null);

if (error) {
  console.error("[FAIL] fetch videos:", error.message);
  process.exit(1);
}
console.log(`${vids.length} videos missing a preview frame.\n`);

let ok = 0;
let failed = 0;

async function doOne(v: { id: string; object_key: string | null }) {
  const name = v.object_key?.split("/").pop() ?? v.id;
  if (!v.object_key) {
    failed++;
    console.warn(`[fail] ${name}: no object_key`);
    return;
  }
  try {
    // Key the thumbnail by the photo's UUID (not the object_key) — object_key
    // can contain characters Supabase Storage rejects (e.g. "~" in phone names).
    const frame = await extractVideoFrame(v.object_key);
    const path = await storeThumbnail(v.id, frame);
    const update: Record<string, unknown> = { thumbnail_path: path };
    try {
      const a = await analyzePhoto(frame);
      if (a.description) update.description = a.description;
      if (a.tags?.length) update.tags = a.tags;
    } catch {
      /* describing the frame is a bonus; the thumbnail is the goal */
    }
    const { error: upErr } = await sb.from("photos").update(update).eq("id", v.id);
    if (upErr) throw new Error(upErr.message);
    ok++;
    console.log(`[ok ${ok + failed}/${vids.length}] ${name}`);
  } catch (e) {
    failed++;
    console.warn(`[fail ${ok + failed}/${vids.length}] ${name}: ${(e as Error).message}`);
  }
}

const queue = [...vids];
async function worker() {
  while (queue.length) {
    const v = queue.shift();
    if (v) await doOne(v);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

console.log(`\nDone. thumbnails added=${ok}  failed=${failed}  of ${vids.length}`);
