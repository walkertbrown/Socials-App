import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getReportByWeek, clearNarratives, saveReportPayload } from "@/lib/db/weekly-reports";
import { computeWeek, toDateString } from "@/lib/report/compute-week";
import { generateWinNarrative, generateRecommendNarrative } from "@/lib/report/narratives";
import { computeFlag } from "@/lib/report/flag";
import { saveNarratives } from "@/lib/db/weekly-reports";

export const runtime = "nodejs";
export const maxDuration = 60;

// Auth-gated manual "Regenerate" endpoint.
// Nulls narratives_generated_at, re-runs the compute, re-calls Claude.
// This is the only path that can null narratives_generated_at — the cron
// never does this, so a retry loop is impossible.
//
// POST /api/reports/generate
// Body: { weekStart: "YYYY-MM-DD" }
export async function POST(request: NextRequest) {
  // Auth gate — must be logged in.
  const user = await getUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const weekStart = body.weekStart as string | undefined;
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "weekStart required (YYYY-MM-DD)" }, { status: 400 });
  }

  // Verify the report exists.
  const existing = await getReportByWeek(weekStart);
  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Null the narratives so the cron would re-generate them on next run.
  // Then immediately re-generate them now for instant UI feedback.
  await clearNarratives(weekStart);

  // Re-compute the full week payload (refreshes metrics from DB).
  const weekDate = new Date(weekStart + "T00:00:00.000Z");
  const payload = await computeWeek(weekDate);
  await saveReportPayload(weekStart, payload);

  // Re-run Claude narratives.
  const [win, recommend] = await Promise.all([
    generateWinNarrative(payload),
    generateRecommendNarrative(payload),
  ]);
  const flag = computeFlag(payload.posts, payload.igSnapshot, payload.priorIgSnapshot);
  await saveNarratives(weekStart, win, recommend, flag.text ?? "");

  return NextResponse.json({ ok: true, weekStart });
}
