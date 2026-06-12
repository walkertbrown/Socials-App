import "server-only";
import { google } from "googleapis";

// Read-only Drive client authenticated as a service account.
// The venue folder must be shared with the service account's email.
export function createDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("Missing Google service account env vars");
  }
  // Env vars store the key with literal \n; turn them back into newlines.
  const key = rawKey.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}
