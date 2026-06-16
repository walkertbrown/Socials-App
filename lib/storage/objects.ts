import "server-only";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, s3Bucket } from "@/lib/storage/client";

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date | undefined;
}

// Download the bytes of one object from MinIO. Used by process-photo to get the
// original so it can make a thumbnail — the original itself never touches Supabase.
export async function getObjectBytes(key: string): Promise<Buffer> {
  const s3 = createS3Client();
  const res = await s3.send(
    new GetObjectCommand({ Bucket: s3Bucket(), Key: key })
  );
  if (!res.Body) throw new Error(`Empty body for key: ${key}`);
  // Body is a ReadableStream in Node — collect it into a Buffer.
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// A short-lived presigned URL. Used by /api/download/[id] and the video route to
// redirect the browser directly to MinIO so the app server never buffers bytes.
// Pass `inline: true` for video playback (no forced download); omit or pass false
// for file downloads. Pass `filename` to set a download filename.
export async function getSignedDownloadUrl(
  key: string,
  ttlSeconds = 600,
  filename?: string,
  inline = false
): Promise<string> {
  const s3 = createS3Client();
  const disposition = inline
    ? "inline"
    : filename
      ? `attachment; filename="${encodeURIComponent(filename)}"`
      : "attachment";
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: s3Bucket(),
      Key: key,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn: ttlSeconds }
  );
}

// A short-lived presigned URL that lets the browser PUT a file directly to MinIO,
// skipping the app server entirely. The browser includes Content-Type in the PUT
// and MinIO enforces it (so we pass it here to match). TTL defaults to 15 minutes,
// which is enough for large files on a home connection.
export async function getSignedPutUrl(
  objectKey: string,
  contentType: string,
  ttlSeconds = 900
): Promise<string> {
  const s3 = createS3Client();
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: s3Bucket(),
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: ttlSeconds }
  );
}

// List every object under an optional key prefix (pass "" for all objects).
// Handles MinIO's 1000-object pagination so the caller gets a flat list.
export async function listObjects(prefix = ""): Promise<StorageObject[]> {
  const s3 = createS3Client();
  const bucket = s3Bucket();
  const results: StorageObject[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      results.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified,
      });
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return results;
}
