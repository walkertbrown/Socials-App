import "server-only";
import { graph } from "@/lib/meta/client";
import { getMetaCredentials, saveMetaCredentials } from "@/lib/db/meta-credentials";

// Extends the long-lived token and stores the new expiry. Returns days remaining.
export async function refreshToken(): Promise<{ daysLeft: number }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const creds = await getMetaCredentials();
  if (!appId || !appSecret) throw new Error("Missing META_APP_ID / META_APP_SECRET");
  if (!creds?.page_token) throw new Error("No Meta token to refresh");

  const res = await graph("oauth/access_token", {
    token: creds.page_token,
    params: {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: creds.page_token,
    },
  });

  const expiresIn = res.expires_in ? Number(res.expires_in) : 60 * 24 * 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  await saveMetaCredentials({ page_token: res.access_token, token_expires_at: expiresAt });
  return { daysLeft: Math.round(expiresIn / 86400) };
}

// Days until the stored token expires (for the "expires in N days" warning).
export function daysUntil(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.round((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}
