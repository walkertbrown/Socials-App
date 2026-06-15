// Backfill: match existing photos rows to their MinIO object keys.
//
// Run AFTER the rclone Drive→MinIO copy is complete and the bucket is populated.
// Safe to run more than once — only rows where object_key IS NULL are touched.
//
// Run: node --env-file=.env.local scripts/backfill-object-keys.mjs
//
// What it does:
//   1. Lists every object in the MinIO bucket.
//   2. For each existing photo row that has drive_name set and object_key still null,
//      finds the matching MinIO object by filename (basename of the key).
//   3. Sets object_key + storage_backend='minio' on matched rows.
//
// Category folder → app category mapping (from 003_SORTED Content Library):
//   01_Food and Drink    → food_drink
//   02_Behind the Scenes → behind_scenes
//   03_Events            → events
//   04_Atmosphere        → atmosphere
//   05_Video             → videos
//   000_UNSORTED         → unsorted
//
// The rclone copy preserves the Drive folder structure under the key prefix, so
// "03_Events/my-photo.jpg" in the bucket means category=events in the DB.
// This script reads that prefix to set category automatically on unset rows.

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const {
  S3_ENDPOINT,
  S3_REGION = "us-east-1",
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_FORCE_PATH_STYLE,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
  console.error("[FAIL] Missing S3 env vars");
  process.exit(1);
}
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[FAIL] Missing Supabase env vars");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  forcePathStyle: String(S3_FORCE_PATH_STYLE) === "true",
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
});

const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Category folder → app category key mapping.
const FOLDER_TO_CATEGORY = {
  "01_food and drink": "food_drink",
  "02_behind the scenes": "behind_scenes",
  "03_events": "events",
  "04_atmosphere": "atmosphere",
  "05_video": "videos",
  "000_unsorted": "unsorted",
};

function categoryFromKey(key) {
  // The key looks like "003_SORTED Content Library/03_Events/my-photo.jpg"
  // or simply "03_Events/my-photo.jpg" depending on how rclone was run.
  // Match on any path segment.
  const lower = key.toLowerCase();
  for (const [folder, cat] of Object.entries(FOLDER_TO_CATEGORY)) {
    if (lower.includes(folder)) return cat;
  }
  return null; // No match — leave category as-is in the DB.
}

// List all objects in the bucket.
async function listAllObjects() {
  const objects = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: S3_BUCKET, ContinuationToken: token })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) objects.push(obj.Key);
    }
    token = res.NextContinuationToken;
  } while (token);
  return objects;
}

const allKeys = await listAllObjects();
console.log(`[INFO] ${allKeys.length} objects in bucket`);

// Build a map of filename → [ full key ] for fast lookup.
// Multiple keys can share the same filename (different folders), so we keep all matches.
const byFilename = new Map();
for (const key of allKeys) {
  const name = key.split("/").pop();
  if (!name) continue;
  if (!byFilename.has(name)) byFilename.set(name, []);
  byFilename.get(name).push(key);
}

// Fetch all photo rows that haven't been backfilled yet.
const { data: photos, error: fetchErr } = await sb
  .from("photos")
  .select("id, drive_name, object_key, category")
  .is("object_key", null);

if (fetchErr) {
  console.error("[FAIL] Could not fetch photos:", fetchErr.message);
  process.exit(1);
}
console.log(`[INFO] ${photos.length} rows with object_key=null to process`);

let matched = 0;
let ambiguous = 0;
let noMatch = 0;

for (const photo of photos) {
  if (!photo.drive_name) {
    noMatch++;
    continue;
  }
  const candidates = byFilename.get(photo.drive_name) ?? [];
  if (candidates.length === 0) {
    console.warn(`[WARN] No match for "${photo.drive_name}" (id=${photo.id})`);
    noMatch++;
    continue;
  }
  if (candidates.length > 1) {
    console.warn(
      `[WARN] Ambiguous: "${photo.drive_name}" matches ${candidates.length} keys — skipping (id=${photo.id})`
    );
    ambiguous++;
    continue;
  }

  const key = candidates[0];
  const detectedCategory = categoryFromKey(key);
  const updates = {
    object_key: key,
    storage_backend: "minio",
  };
  // Only set category if the row doesn't already have one and we detected a folder.
  if (!photo.category && detectedCategory) {
    updates.category = detectedCategory;
  }

  const { error: updateErr } = await sb
    .from("photos")
    .update(updates)
    .eq("id", photo.id);

  if (updateErr) {
    console.error(`[ERROR] Could not update ${photo.id}:`, updateErr.message);
  } else {
    matched++;
  }
}

console.log(`\n[DONE] matched=${matched}  ambiguous=${ambiguous}  no_match=${noMatch}`);
if (ambiguous > 0) {
  console.log(
    "  Ambiguous rows were skipped. Manually set their object_key values in the Supabase dashboard."
  );
}
if (noMatch > 0) {
  console.log(
    "  Un-matched rows still have object_key=null. They will be skipped by sync until resolved."
  );
}
