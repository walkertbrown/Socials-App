import "server-only";
import { google } from "googleapis";

// Drive client authenticated AS the owner (walkertbrown@gmail.com) via OAuth.
// Acting as the owner is what lets the app MOVE photos into the category folders —
// a service account couldn't, because it didn't own the files.
export function createDriveClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth env vars (client id / secret / refresh token)");
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
}
