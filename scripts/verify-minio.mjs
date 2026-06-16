// Verify authenticated MinIO (S3) access end-to-end: a signed ListObjectsV2 and a
// presigned GET URL. Confirms the funnel + creds + path-style config in .env.local
// actually work before building the storage layer on top of them.
// Run: node --env-file=.env.local scripts/verify-minio.mjs
import { S3Client, ListObjectsV2Command, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const {
  S3_ENDPOINT,
  S3_REGION = "us-east-1",
  S3_BUCKET,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_FORCE_PATH_STYLE,
} = process.env;

console.log("Endpoint:", S3_ENDPOINT);
console.log("Bucket:  ", S3_BUCKET);
console.log("Key:     ", S3_ACCESS_KEY);

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  forcePathStyle: String(S3_FORCE_PATH_STYLE) === "true",
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
});

try {
  await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  console.log("\n[OK] HeadBucket — bucket exists and creds authorize it.");

  const out = await s3.send(
    new ListObjectsV2Command({ Bucket: S3_BUCKET, MaxKeys: 10 })
  );
  const n = out.KeyCount ?? 0;
  console.log(`[OK] ListObjectsV2 — ${n} object(s) returned (showing up to 10):`);
  for (const o of out.Contents ?? []) {
    console.log(`     ${o.Key}  (${o.Size} bytes)`);
  }
  if (n === 0) console.log("     (bucket is empty — expected until the rclone copy runs)");

  const sample = out.Contents?.[0]?.Key ?? "does-not-exist.jpg";
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: sample }),
    { expiresIn: 600 }
  );
  console.log("\n[OK] Presigned GET URL generated (this is how downloads will work):");
  console.log("     " + url.slice(0, 120) + "...");

  console.log("\nAuth verified. Safe to build the storage layer.");
} catch (err) {
  console.error("\n[FAIL]", err.name + ":", err.message);
  if (err.$metadata) console.error("HTTP status:", err.$metadata.httpStatusCode);
  process.exit(1);
}
