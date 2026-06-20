import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processDueBatch } from "@/lib/outreach/process-drip";

export const runtime = "nodejs";

// Manual "run the due batch now (simulate)" trigger for the Scheduler UI, so the
// user can watch the plan advance without waiting for the daily cron.
// STEP 1: ALWAYS dry-run — sends nothing. Step 2 adds a real-send path.
export async function POST() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const result = await processDueBatch({ dryRun: true });
    return NextResponse.json(result);
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
