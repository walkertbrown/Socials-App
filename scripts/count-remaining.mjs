// One-off: how many bucket IMAGE objects are not yet ingested (no DB row with that object_key)?
// Read-only. Run: node --env-file=.env.local scripts/count-remaining.mjs
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const {
  S3_ENDPOINT, S3_REGION = "us-east-1", S3_BUCKET,
  S3_ACCESS_KEY, S3_SECRET_KEY, S3_FORCE_PATH_STYLE,
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const s3 = new S3Client({
  endpoint: S3_ENDPOINT, region: S3_REGION,
  forcePathStyle: String(S3_FORCE_PATH_STYLE) === "true",
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
});
const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const IMG = /\.(jpe?g|png|webp|heic|heif|gif|tiff?)$/i;
const VID = /\.(mp4|mov|m4v|avi|mkv|webm)$/i;

const keys = [];
let token;
do {
  const res = await s3.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, ContinuationToken: token }));
  for (const o of res.Contents ?? []) if (o.Key) keys.push(o.Key);
  token = res.NextContinuationToken;
} while (token);

const images = keys.filter((k) => IMG.test(k));
const videos = keys.filter((k) => VID.test(k));
const other = keys.filter((k) => !IMG.test(k) && !VID.test(k));

// Existing object_keys in the DB.
const existing = new Set();
let from = 0;
const PAGE = 1000;
for (;;) {
  const { data, error } = await sb
    .from("photos").select("object_key")
    .not("object_key", "is", null)
    .range(from, from + PAGE - 1);
  if (error) throw error;
  for (const r of data) existing.add(r.object_key);
  if (data.length < PAGE) break;
  from += PAGE;
}

const remainingImages = images.filter((k) => !existing.has(k));

console.log("bucket objects total :", keys.length);
console.log("  images             :", images.length);
console.log("  videos             :", videos.length);
console.log("  other              :", other.length);
console.log("DB object_keys set   :", existing.size);
console.log("IMAGES not yet ingested (the vision-tag cost driver):", remainingImages.length);

// Category folder breakdown of remaining images.
const byCat = {};
for (const k of remainingImages) {
  const seg = k.split("/").find((s) => /^\d/.test(s) && s.includes("_")) ?? "(none)";
  byCat[seg] = (byCat[seg] ?? 0) + 1;
}
console.log("remaining images by folder:");
for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c}: ${n}`);
}
