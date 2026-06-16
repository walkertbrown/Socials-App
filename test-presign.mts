// Test 4: getSignedOriginalUrl and getSignedDownloadUrl (inline param)

import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_ENDPOINT = process.env.S3_ENDPOINT!;
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_BUCKET = process.env.S3_BUCKET!;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY!;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY!;
const FORCE_PATH = process.env.S3_FORCE_PATH_STYLE === "true";

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: FORCE_PATH,
});

const OBJECT_KEY = "003_SORTED Content Library/03_Events/photo_20260509_203622_39.jpeg";

// Mirror getSignedDownloadUrl from lib/storage/objects.ts
async function getSignedDownloadUrl(
  key: string,
  ttlSeconds = 600,
  filename?: string,
  inline = false
): Promise<string> {
  const disposition = inline
    ? "inline"
    : filename
      ? `attachment; filename="${encodeURIComponent(filename)}"`
      : "attachment";
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn: ttlSeconds }
  );
}

console.log("--- Test 4a: attachment URL (getSignedOriginalUrl) ---");
const attachUrl = await getSignedDownloadUrl(OBJECT_KEY, 600, "photo.jpg", false);
console.log("URL starts with S3 endpoint:", attachUrl.startsWith(S3_ENDPOINT));

const r1 = await fetch(attachUrl, { method: "HEAD" });
console.log("HTTP status:", r1.status);
console.log("Content-Disposition:", r1.headers.get("content-disposition"));
if (r1.status === 200) {
  console.log("PASS: attachment presigned URL works");
} else {
  console.error("FAIL: attachment URL returned", r1.status);
}

console.log("\n--- Test 4b: inline URL (getSignedDownloadUrl with inline=true) ---");
const inlineUrl = await getSignedDownloadUrl(OBJECT_KEY, 600, undefined, true);
const r2 = await fetch(inlineUrl, { method: "HEAD" });
console.log("HTTP status:", r2.status);
console.log("Content-Disposition:", r2.headers.get("content-disposition"));
if (r2.status === 200) {
  console.log("PASS: inline presigned URL works");
} else {
  console.error("FAIL: inline URL returned", r2.status);
}

// Verify the inline vs attachment distinction is real
const attachDisp = (await (await fetch(attachUrl, { method: "HEAD" })).headers.get("content-disposition")) ?? "";
const inlineDisp = (await (await fetch(inlineUrl, { method: "HEAD" })).headers.get("content-disposition")) ?? "";
console.log("\nAttachment disposition:", attachDisp);
console.log("Inline disposition:", inlineDisp);

const distinctionWorks = attachDisp.includes("attachment") && inlineDisp === "inline";
console.log("Inline vs attachment distinction is present:", distinctionWorks ? "YES" : "NO");
