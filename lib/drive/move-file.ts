import "server-only";
import { createDriveClient } from "@/lib/drive/client";

// Moves a file into a destination folder: add the new parent, remove the old ones.
// This MOVES (never copies or deletes), so it's reversible.
export async function moveFile(fileId: string, destFolderId: string): Promise<void> {
  const drive = createDriveClient();
  const current = await drive.files.get({
    fileId,
    fields: "parents",
    supportsAllDrives: true,
  });
  const parents = current.data.parents ?? [];
  if (parents.includes(destFolderId)) return; // already in the right place
  const previousParents = parents.join(",");
  await drive.files.update({
    fileId,
    addParents: destFolderId,
    removeParents: previousParents,
    fields: "id, parents",
    supportsAllDrives: true,
  });
}
