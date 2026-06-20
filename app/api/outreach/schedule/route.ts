import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listSchedule, saveSchedule, type SaveRow } from "@/lib/db/outreach-schedule";
import { countSendablePool } from "@/lib/outreach/process-drip";
import { buildRampPlan, todayChicago, addDays } from "@/lib/outreach/schedule-plan";

export const runtime = "nodejs";

async function requireUser() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// GET — the current schedule, the sendable-pool size, running totals, and (only
// when no schedule exists yet) a prefilled warm-up ramp starting tomorrow.
export async function GET() {
  if (!(await requireUser())) return new NextResponse("Unauthorized", { status: 401 });

  const [rows, poolSize] = await Promise.all([listSchedule(), countSendablePool()]);
  const totalScheduled = rows.reduce((s, r) => s + r.target_count, 0);
  const totalSent = rows.reduce((s, r) => s + r.sent_count, 0);
  const prefill = rows.length === 0 ? buildRampPlan(addDays(todayChicago(), 1), poolSize) : null;

  return NextResponse.json({ rows, poolSize, totalScheduled, totalSent, prefill });
}

// PUT — replace the schedule with the submitted rows (diff-based save).
export async function PUT(request: NextRequest) {
  if (!(await requireUser())) return new NextResponse("Unauthorized", { status: 401 });

  let body: { rows?: SaveRow[] };
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.scheduled_date)) {
      return new NextResponse("Each row needs a valid YYYY-MM-DD date.", { status: 400 });
    }
    if (typeof r.target_count !== "number" || !Number.isFinite(r.target_count) || r.target_count < 0) {
      return new NextResponse("Each row needs a non-negative count.", { status: 400 });
    }
  }

  try {
    const saved = await saveSchedule(rows);
    return NextResponse.json({ rows: saved });
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
