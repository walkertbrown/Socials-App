import "server-only";
import { google } from "googleapis";

// A short-lived OAuth access token for the owner account. Used to authorize a
// direct Drive media download — either for ffmpeg to range-read a few bytes of a
// video, or to stream the full file to her at post time. Avoids ever buffering a
// whole video into memory.
export async function getDriveAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth env vars (client id / secret / refresh token)");
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("Could not obtain Drive access token");
  return token;
}

// The Drive "download the bytes" URL. Supports HTTP range requests, so a client
// (ffmpeg, or her browser) only pulls what it needs.
export function driveMediaUrl(fileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
}
