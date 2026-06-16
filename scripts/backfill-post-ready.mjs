// One-time backfill: generate a 2048px post-ready JPEG for every photo that
// doesn't have one yet. Reads the original from MinIO, resizes with sharp, stores
// in the 'post-ready' Supabase bucket under {photoId}.jpg, then stamps
// post_ready_path. Safe to re-run — only touches photos where post_ready_path IS NULL.
//
// Prerequisites:
//   - Migration 0012_post_ready_path.sql must be applied first (creates the bucket).
//   - Run from the repo root on a machine with MinIO access (LAN or funnel).
//
// Run:  node --env-file=.env.local scripts/backfill-post-ready.mjs
// Box:  node --env-file=.env.box  scripts/backfill-post-ready.mjs
//       (box has LAN access to MinIO — much faster than over the funnel)

import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

const BUCKET = process.env.S3_BUCKET ?? "pelican-media";

async function getOriginal(objectKey) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function isHeic(buf) {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12).toLowerCase();
  return ["heic", "heix", "heif", "mif1", "msf1", "hevc", "heim", "heis", "hevm", "hevs"].includes(brand);
}

async function toPostJpeg(original) {
  let input = original;
  if (isHeic(original)) {
    // Dynamic import — heic-convert is ESM and only needed for iPhone originals.
    const { default: heicConvert } = await import("heic-convert");
    input = Buffer.from(await heicConvert({ buffer: original, format: "JPEG", quality: 0.95 }));
  }
  return sharp(input)
    .rotate()
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}

// Fetch photos that need a post-ready copy.
// Skip videos — they don't publish as images.
// Skip rows without an object_key — Drive-only legacy photos with no MinIO original.
const { data: photos, error } = await sb
  .from("photos")
  .select("id, object_key, category")
  .is("post_ready_path", null)
  .not("object_key", "is", null)
  .neq("category", "videos")
  .in("status", ["ready", "pending_review"]);

if (error) { console.error("Query failed:", error.message); process.exit(1); }

console.log(`${photos.length} photos need a post-ready copy.\n`);

let done = 0, failed = 0;

for (const photo of photos) {
  try {
    const original = await getOriginal(photo.object_key);
    const jpeg = await toPostJpeg(original);

    const path = `${photo.id}.jpg`;
    const { error: uploadErr } = await sb.storage
      .from("post-ready")
      .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);

    const { error: updateErr } = await sb
      .from("photos")
      .update({ post_ready_path: path })
      .eq("id", photo.id);
    if (updateErr) throw new Error(updateErr.message);

    done++;
    const kb = Math.round(jpeg.length / 1024);
    console.log(`✓ ${done}/${photos.length}  ${kb} KB  ${photo.object_key}`);
  } catch (e) {
    failed++;
    console.warn(`✗ ${photo.id} (${photo.object_key}): ${e.message}`);
  }
}

console.log(`\nDone. Generated ${done}, failed ${failed}.`);
