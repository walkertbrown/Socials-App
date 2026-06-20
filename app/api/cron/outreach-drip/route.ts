import { NextResponse, type NextRequest } from "next/server";
import { processDueBatch } from "@/lib/outreach/process-drip";

export const runtime = "nodejs";
export const maxDuration = 60;

// Daily outreach drip — processes the earliest due batch (at most one per day).
//
// STEP 1: dry-run ONLY — sends nothing; marks the picked drafts 'simulated'.
// Step 2 will flip dryRun to false (behind the same per-day batch cap) once
// Resend + suppression/unsubscribe + CAN-SPAM footer are wired.
//
// Trigger from the home-server crontab in LOCAL America/Chicago time, e.g. 9am:
//   0 9 * * * curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<prod-domain>/api/cron/outreach-drip >/dev/null
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await processDueBatch({ dryRun: true });
  return NextResponse.json(result);
}
