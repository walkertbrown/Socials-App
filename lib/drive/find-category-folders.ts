import "server-only";
import { createDriveClient } from "@/lib/drive/client";
import { FOLDER_TARGETS } from "@/lib/categories";

// Discovers the destination subfolders by looking at the sorted library — which
// we find as the parent of the "unsorted" folder, so no extra folder id is needed.
// Returns a map of target key -> Drive folder id (categories + the videos folder).
export async function getCategoryFolderMap(
  unsortedFolderId: string
): Promise<Record<string, string>> {
  const drive = createDriveClient();

  const meta = await drive.files.get({
    fileId: unsortedFolderId,
    fields: "parents",
    supportsAllDrives: true,
  });
  const libraryId = meta.data.parents?.[0];
  if (!libraryId) {
    throw new Error("Could not find the sorted library (parent of the unsorted folder).");
  }

  const res = await drive.files.list({
    q: `'${libraryId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const map: Record<string, string> = {};
  for (const folder of res.data.files ?? []) {
    const target = FOLDER_TARGETS.find((c) => folder.name && c.match.test(folder.name));
    if (target && folder.id) map[target.key] = folder.id;
  }
  return map;
}
