import "server-only";
import { graph } from "@/lib/meta/client";
import { getMetaCredentials } from "@/lib/db/meta-credentials";

export type TokenStatus = "valid" | "expiring" | "dead" | "unknown";

export interface TokenHealth {
  status: TokenStatus;
  expiresAt: Date | null;
  // Days remaining — null when status is 'dead' or 'unknown'.
  daysLeft: number | null;
}

// Token is "expiring" if it expires within this many days.
const EXPIRING_THRESHOLD_DAYS = 14;

// Verify a stored page token via Meta's debug_token endpoint.
// Never throws — returns { status: 'unknown' } on any error.
export async function checkTokenHealth(): Promise<TokenHealth> {
  try {
    const creds = await getMetaCredentials();
    if (!creds?.page_token) {
      return { status: "dead", expiresAt: null, daysLeft: null };
    }

    // Use the page token as both the input_token and access_token.
    // This works for long-lived page tokens (they debug themselves).
    const data = await graph("debug_token", {
      token: creds.page_token,
      params: {
        input_token: creds.page_token,
        // access_token is injected by graph() from the token param
      },
    });

    const info = data?.data;
    if (!info?.is_valid) {
      return { status: "dead", expiresAt: null, daysLeft: null };
    }

    // expires_at is a Unix timestamp (0 means never-expiring — page tokens).
    const expiresEpoch = info.expires_at as number | undefined;
    if (!expiresEpoch || expiresEpoch === 0) {
      // Page tokens with no expiry are long-lived — treat as valid.
      return { status: "valid", expiresAt: null, daysLeft: null };
    }

    const expiresAt = new Date(expiresEpoch * 1000);
    const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      return { status: "dead", expiresAt, daysLeft: 0 };
    }

    const status: TokenStatus = daysLeft <= EXPIRING_THRESHOLD_DAYS ? "expiring" : "valid";
    return { status, expiresAt, daysLeft };
  } catch {
    return { status: "unknown", expiresAt: null, daysLeft: null };
  }
}
