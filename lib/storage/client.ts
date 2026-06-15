import "server-only";
import { S3Client } from "@aws-sdk/client-s3";

// S3-compatible client pointing at the self-hosted MinIO instance (ServerMac).
// Path-style addressing is required because MinIO doesn't support virtual-hosted-style
// unless a wildcard DNS record is set up — which it isn't on the home network.
export function createS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE) === "true";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing S3 env vars (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY)");
  }

  return new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function s3Bucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET env var is not set");
  return bucket;
}
