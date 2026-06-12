import "server-only";
import { createDriveClient } from "@/lib/drive/client";

// Downloads one original's bytes. Used transiently to build a thumbnail —
// the original is never stored anywhere by this app.
export async function fetchDriveFile(fileId: string): Promise<Buffer> {
  const drive = createDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}
