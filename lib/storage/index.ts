import "server-only";
// Storage adapter — all photos live in MinIO. This thin wrapper exists so callers
// don't import from lib/storage/objects directly and we can keep the public API stable.

import { getObjectBytes, getSignedDownloadUrl } from "@/lib/storage/objects";

export interface StorablePhoto {
  id: string;
  storage_backend: string | null;
  object_key: string | null;
  // Kept for any existing callers that pass drive_file_id; ignored — MinIO only now.
  drive_file_id?: string | null;
  display_name?: string | null;
  drive_name?: string | null;
}

// Download the full original bytes from MinIO. Used by process-photo to build a
// thumbnail — the original is never stored in Supabase.
export async function getOriginal(photo: StorablePhoto): Promise<Buffer> {
  if (!photo.object_key) {
    throw new Error(`Photo ${photo.id} has no object_key`);
  }
  return getObjectBytes(photo.object_key);
}

// A short-lived presigned URL for browser downloads. Redirects directly to MinIO
// so the app server never buffers the original bytes.
export async function getSignedOriginalUrl(
  photo: StorablePhoto,
  ttlSeconds = 600
): Promise<string> {
  if (!photo.object_key) {
    throw new Error(`Cannot produce a presigned URL for photo ${photo.id}: no object_key`);
  }
  const filename =
    photo.display_name ?? photo.drive_name ?? photo.object_key.split("/").pop();
  return getSignedDownloadUrl(photo.object_key, ttlSeconds, filename ?? undefined);
}
