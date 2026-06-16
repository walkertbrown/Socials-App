// Drive the REAL ingestion pipeline over the MinIO bucket — the same code the
// "Sync & Sort" button runs, just from the command line (no login needed; the
// pipeline uses the service-role key). Sync inserts placeholder rows for any new
// objects, then each photo is processed one at a time: download original from
// MinIO -> thumbnail -> perceptual hash + dedupe -> one Haiku vision tag -> ready.
//
// Idempotent: known object_keys are skipped on insert; already-`ready` photos are
// skipped by processOnePhoto. Safe to re-run / resume after an interruption.
//
// Optional first arg = max photos to process this run (for a smoke test).
// Run: node --conditions=react-server --env-file=.env.local --import tsx scripts/ingest-minio.mts [limit]
import ws from "ws";
import { listObjects } from "@/lib/storage/objects";
import { insertMinioPlaceholders, getProcessingIds } from "@/lib/db/photos";
import { processOnePhoto } from "@/lib/process/process-photo";

// Supabase's realtime client expects a global WebSocket. Node <22 (the box runs
// Node 20) has none natively, so shim it before any Supabase client is created.
(globalThis as { WebSocket?: unknown }).WebSocket ??= ws as unknown;

const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;

const isMedia = (key: string) =>
  /\.(jpg|jpeg|png|gif|webp|heic|heif|tiff?|bmp|mp4|mov|m4v|avi|mkv|webm)$/i.test(key);

console.log("Listing MinIO objects…");
const objects = await listObjects("");
const media = objects.filter((o) => isMedia(o.key));
console.log(`${objects.length} objects in bucket, ${media.length} media files.`);

const inserted = await insertMinioPlaceholders(
  media.map((o) => ({ key: o.key, name: o.key.split("/").pop() ?? o.key }))
);
console.log(`Inserted ${inserted} new placeholder rows (existing ones skipped).`);

const ids = await getProcessingIds();
const target = Math.min(ids.length, limit);
console.log(`${ids.length} photos pending. Processing ${target} this run.\n`);

let done = 0;
let ready = 0;
let errors = 0;
const runStart = Date.now();

for (const id of ids) {
  if (done >= limit) break;
  done++;
  const t0 = Date.now();
  try {
    const r = await processOnePhoto(id);
    if (r.status === "ready") ready++;
    const tag = r.category ? ` ${r.category}` : "";
    const skip = r.skipped ? " (already done)" : "";
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[${done}/${target}] ${r.status}${tag}${skip}  ${secs}s`);
  } catch (e) {
    errors++;
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.warn(`[${done}/${target}] ERROR ${id}: ${(e as Error).message}  ${secs}s`);
  }
}

const mins = ((Date.now() - runStart) / 60000).toFixed(1);
const rate = done > 0 ? ((Date.now() - runStart) / 1000 / done).toFixed(1) : "0";
console.log(`\nDone. processed=${done}  ready=${ready}  errors=${errors}  in ${mins}min  (~${rate}s/photo)`);
