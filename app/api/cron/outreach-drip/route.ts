import { NextResponse, type NextRequest } from "next/server";
import { processDueBatch } from "@/lib/outreach/process-drip";
import { isLiveSending } from "@/lib/outreach/send-config";

export const runtime = "nodejs";
export const maxDuration = 300;

// Daily outreach drip — processes the earliest due batch (at most one per day).
//
// SAFETY: this is dry-run (simulate) UNLESS isLiveSending() is true, i.e. BOTH
// OUTREACH_LIVE=1 and RESEND_API_KEY are set in env. Until you flip those, it
// marks drafts 'simulated' and sends nothing — a deploy alone never emails.
//
// Trigger from the home-server crontab in LOCAL America/Chicago time, e.g. 9am:
//   0 9 * * * curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<prod-domain>/api/cron/outreach-drip >/dev/null
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await processDueBatch({ dryRun: !isLiveSending() });
  return NextResponse.json(result);
}
