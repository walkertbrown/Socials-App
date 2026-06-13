import "server-only";
import { createDriveClient } from "@/lib/drive/client";

// Renames a Drive file (we own it via OAuth, so this is allowed).
export async function renameFile(fileId: string, name: string): Promise<void> {
  const drive = createDriveClient();
  await drive.files.update({ fileId, requestBody: { name }, supportsAllDrives: true });
}
