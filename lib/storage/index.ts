import "server-only";
// Storage adapter — dispatches on storage_backend so we can read photos regardless
// of whether they live in MinIO (new) or Drive (legacy rows pre-migration). This is
// the single place that knows which backend a photo lives on; callers don't need to.

import { getObjectBytes, getSignedDownloadUrl } from "@/lib/storage/objects";
import { fetchDriveFile } from "@/lib/drive/fetch-file";

export interface StorablePhoto {
  id: string;
  storage_backend: string | null;
  object_key: string | null;
  drive_file_id: string | null;
  // Used for Content-Disposition filename when downloading
  display_name?: string | null;
  drive_name?: string | null;
}

// Download the full original bytes. Used by process-photo when it needs to build
// a thumbnail. Falls back to Drive for legacy rows that haven't been migrated.
export async function getOriginal(photo: StorablePhoto): Promise<Buffer> {
  if (photo.storage_backend === "minio" || !photo.drive_file_id) {
    if (!photo.object_key) {
      throw new Error(`Photo ${photo.id} has no object_key but is marked as minio backend`);
    }
    return getObjectBytes(photo.object_key);
  }
  // Legacy Drive row: fall through to the existing Drive download.
  return fetchDriveFile(photo.drive_file_id);
}

// A short-lived presigned URL for browser downloads. MinIO only — Drive originals
// aren't served this way (the route returns 400 for drive-backend photos).
export async function getSignedOriginalUrl(
  photo: StorablePhoto,
  ttlSeconds = 600
): Promise<string> {
  if (photo.storage_backend !== "minio" || !photo.object_key) {
    throw new Error(
      `Cannot produce a presigned URL for photo ${photo.id}: not on MinIO backend`
    );
  }
  const filename =
    photo.display_name ?? photo.drive_name ?? photo.object_key.split("/").pop();
  return getSignedDownloadUrl(photo.object_key, ttlSeconds, filename ?? undefined);
}
