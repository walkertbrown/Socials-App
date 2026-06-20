import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processDueBatch } from "@/lib/outreach/process-drip";
import { isLiveSending } from "@/lib/outreach/send-config";

export const runtime = "nodejs";
export const maxDuration = 300;

// The manual "Send next batch" action — the ONLY way a batch ever sends (there is
// no cron). Sends the next pending batch regardless of its planned date. It sends
// for real only when isLiveSending() (OUTREACH_LIVE=1 + RESEND_API_KEY); otherwise
// it simulates so you can preview.
export async function POST() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const result = await processDueBatch({ dryRun: !isLiveSending(), ignoreDate: true });
    return NextResponse.json(result);
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
