import "server-only";

// verify-email.ts — calls the MyEmailVerifier single-verify API for one address.
// Returns a normalized status. Never called from CSV import; only from the
// API route that gates generation.
//
// MyEmailVerifier "Status" → our status mapping:
//   Valid                        → "valid"    (but catch_all=true → "catchall")
//   Invalid / Disposable_Domain  → "invalid"  (treat as invalid, skip)
//   Catch All / catch_all=true   → "catchall"
//   Unknown / Greylisted / other → "unknown"
//   missing Status / API error   → "unknown"; a credit/daily-limit error → quota_exhausted flag
//
// Free tier: 100 verifications/day, no card. Key read from MYEMAILVERIFIER_API_KEY.

export type VerifyStatus = "valid" | "invalid" | "catchall" | "unknown" | "not_configured";

export interface VerifyResult {
  status: VerifyStatus;
  quota_exhausted?: boolean;
}

const MEV_URL = "https://api.myemailverifier.com/api/validate_single.php";

export async function verifyEmail(email: string): Promise<VerifyResult> {
  const apiKey = process.env.MYEMAILVERIFIER_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  let data: Record<string, unknown> = {};
  let rawText = "";
  try {
    const url = new URL(MEV_URL);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("email", email);
    const res = await fetch(url.toString(), { method: "GET" });
    rawText = await res.text();
    try { data = JSON.parse(rawText); } catch { data = {}; }
  } catch (err) {
    // Network/parse failure — return unknown so we don't block the batch.
    console.warn("[verify-email] MyEmailVerifier fetch error:", err);
    return { status: "unknown" };
  }

  const status = String(data.Status ?? "").trim();

  // No Status field = an error payload. MyEmailVerifier's error format isn't
  // documented, so sniff the body for a credit/daily-limit/key problem and
  // surface it as quota_exhausted (the run pauses gracefully); otherwise unknown.
  if (!status) {
    const blob = (rawText + " " + JSON.stringify(data)).toLowerCase();
    if (/credit|limit|quota|exceed|insufficient|upgrade|api ?key|unauthor/.test(blob)) {
      return { status: "unknown", quota_exhausted: true };
    }
    console.warn("[verify-email] MyEmailVerifier no Status in response:", rawText.slice(0, 200));
    return { status: "unknown" };
  }

  return { status: mapResult(status, data) };
}

function truthy(v: unknown): boolean {
  return String(v ?? "").trim().toLowerCase() === "true";
}

function mapResult(status: string, data: Record<string, unknown>): VerifyStatus {
  const s = status.toLowerCase();
  if (truthy(data.Disposable_Domain)) return "invalid";
  if (truthy(data.Catch_all) || truthy(data.catch_all) || s.includes("catch")) return "catchall";
  if (s === "valid") return "valid";
  if (s === "invalid") return "invalid";
  return "unknown"; // Unknown, Greylisted, Role-based handled by caller, etc.
}
