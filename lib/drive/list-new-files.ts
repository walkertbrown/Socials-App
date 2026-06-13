import "server-only";
import { createDriveClient } from "@/lib/drive/client";

export interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

// Lists every image under a folder, recursing into subfolders so it works
// whether photos sit in one flat folder or are nested.
export async function listImagesRecursive(folderId: string): Promise<DriveImage[]> {
  const drive = createDriveClient();
  const images: DriveImage[] = [];
  const queue: string[] = [folderId];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${current}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType)",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of res.data.files ?? []) {
        if (!f.id) continue;
        if (f.mimeType === FOLDER_MIME) {
          queue.push(f.id);
        } else if (f.mimeType?.startsWith("image/") || f.mimeType?.startsWith("video/")) {
          images.push({ id: f.id, name: f.name ?? f.id, mimeType: f.mimeType });
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return images;
}
