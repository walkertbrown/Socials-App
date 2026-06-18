import "server-only";

// verify-email.ts — calls the NeverBounce single-verify API for one address.
// Returns a normalized status. Never called from CSV import; only from the
// API route that gates generation.
//
// NeverBounce result → our status mapping:
//   valid       → "valid"
//   invalid     → "invalid"
//   disposable  → "invalid"    (treat as invalid to skip)
//   catchall    → "catchall"
//   unknown     → "unknown"
//   quota/credits error → caller receives "quota_exhausted" flag

export type VerifyStatus = "valid" | "invalid" | "catchall" | "unknown" | "not_configured";

export interface VerifyResult {
  status: VerifyStatus;
  quota_exhausted?: boolean;
}

// NeverBounce single-verify endpoint.
const NB_URL = "https://api.neverbounce.com/v4/single/check";

export async function verifyEmail(email: string): Promise<VerifyResult> {
  const apiKey = process.env.NEVERBOUNCE_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  let data: unknown;
  try {
    const url = new URL(NB_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("email", email);
    url.searchParams.set("credits_info", "0");
    url.searchParams.set("timeout", "5");

    const res = await fetch(url.toString(), { method: "GET" });
    data = await res.json();
  } catch (err) {
    // Network failure or non-JSON body — return unknown so we don't block the batch.
    console.warn("[verify-email] NeverBounce fetch error:", err);
    return { status: "unknown" };
  }

  const d = data as Record<string, unknown>;

  // NeverBounce quota/credits exhaustion returns a non-"success" status with
  // a specific error code or message we detect here.
  if (
    d.status !== "success" &&
    (String(d.message ?? "").toLowerCase().includes("credit") ||
      String(d.message ?? "").toLowerCase().includes("quota") ||
      d.status === "auth_failure")
  ) {
    return { status: "unknown", quota_exhausted: true };
  }

  if (d.status !== "success") {
    // Any other API-level error → return unknown, log it.
    console.warn("[verify-email] NeverBounce non-success:", d.status, d.message);
    return { status: "unknown" };
  }

  const result = String(d.result ?? "unknown");
  return { status: mapResult(result) };
}

function mapResult(result: string): VerifyStatus {
  switch (result) {
    case "valid":
      return "valid";
    case "invalid":
    case "disposable":
      return "invalid";
    case "catchall":
      return "catchall";
    default:
      return "unknown";
  }
}
