import { NextResponse, type NextRequest } from "next/server";
import { requireCredentials } from "@/lib/meta/client";
import { fetchIgAccountInsights, fetchFbPageInsights } from "@/lib/meta/account-insights";
import { fetchIgDemographics } from "@/lib/meta/demographics";
import { runNativeSweep } from "@/lib/meta/native-sweep";
import { checkTokenHealth } from "@/lib/meta/token-health";
import { upsertAccountSnapshot } from "@/lib/db/weekly-snapshots";
import { insertReportShell, saveReportPayload, saveNarratives, getReportByWeek } from "@/lib/db/weekly-reports";
import { computeWeek, getPreviousMondayChicago, getWeekWindow, toDateString } from "@/lib/report/compute-week";
import { generateWinNarrative, generateRecommendNarrative } from "@/lib/report/narratives";
import { computeFlag } from "@/lib/report/flag";
import { sendPushToAll } from "@/lib/notify/web-push";

// Node runtime required for Claude SDK + @react-pdf (both need Node APIs).
export const runtime = "nodejs";
export const maxDuration = 120;

// Secret-gated weekly cron — Vercel sends `Authorization: Bearer <CRON_SECRET>`.
//
// Vercel cron schedule (in vercel.json): "0 9 * * 1" — every Monday at 9am UTC
// (approximately 4am Chicago — after Sun midnight so the full week is in).
//
// pg_cron alternative:
//   SELECT cron.schedule('weekly-insights', '0 9 * * 1',
//     'SELECT net.http_post(''https://<your-domain>/api/cron/weekly-report'',
//     headers := jsonb_build_object(''Authorization'', ''Bearer '' || current_setting(''app.cron_secret'')))');
//
// Cost guards (non-negotiable):
//   1. INSERT … ON CONFLICT DO NOTHING is the idempotency lock — only one run
//      per week actually does work; retries are no-ops.
//   2. narratives_generated_at gate — if already set, skip BOTH Claude calls.
//   3. Native sweep uses since/until — no cursor following, no history pagination.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ── 1. Determine the reporting window (previous Mon–Sun Chicago) ──────────
  const weekStart = getPreviousMondayChicago();
  const weekStartStr = toDateString(weekStart);
  const { since, until } = getWeekWindow(weekStart);

  // ── 2. Idempotency lock — insert the shell row ────────────────────────────
  // If the row already exists, insertReportShell returns false and we skip
  // expensive work (token check, Meta API calls, Claude). Still check
  // narratives_generated_at in case a partial run needs to finish.
  const isNewRun = await insertReportShell(weekStartStr);

  if (!isNewRun) {
    // Row exists — check if narratives need generating (partial run recovery).
    const existing = await getReportByWeek(weekStartStr);
    if (existing?.narratives_generated_at) {
      // Fully complete — nothing to do.
      return NextResponse.json({ skipped: true, reason: "already_complete", week: weekStartStr });
    }
    // Payload exists but no narratives — fall through to narrative generation.
    if (existing?.payload) {
      await generateAndSaveNarratives(weekStartStr, existing.payload as import("@/lib/report/compute-week").WeekPayload);
      return NextResponse.json({ week: weekStartStr, partial_recovery: true });
    }
  }

  // ── 3. Get Meta credentials ───────────────────────────────────────────────
  let creds: Awaited<ReturnType<typeof requireCredentials>>;
  try {
    creds = await requireCredentials();
  } catch {
    return NextResponse.json({ error: "Meta not connected" }, { status: 503 });
  }
  const token = creds.page_token as string;
  const igUserId = creds.ig_user_id as string;
  const pageId = creds.page_id as string;

  // ── 4. Token health check — alert via push if expiring/dead ─────────────
  const health = await checkTokenHealth();
  if (health.status === "expiring" || health.status === "dead") {
    try {
      await sendPushToAll({
        title: health.status === "dead" ? "Meta token expired" : "Meta token expiring soon",
        body:
          health.status === "dead"
            ? "The Meta access token has expired. Re-connect to restore posting."
            : `Meta token expires in ${health.daysLeft} days. Reconnect before it expires.`,
        url: "/posts",
      });
    } catch {
      // Push failure is non-fatal — token health issue is already logged
    }
  }

  // ── 5. Snapshot account-level metrics ─────────────────────────────────────
  const [igAccount, fbPage, igDemographics] = await Promise.all([
    fetchIgAccountInsights(igUserId, token, since, until),
    fetchFbPageInsights(pageId, token, since, until),
    fetchIgDemographics(igUserId, token),
  ]);

  await Promise.all([
    upsertAccountSnapshot({
      platform: "instagram",
      week_start: weekStartStr,
      reach: igAccount.reach,
      views: igAccount.views,
      net_followers: igAccount.net_followers,
      engagement: null,       // IG account-level engagement not in ground-truth
      link_taps: igAccount.link_taps,
      followers_count: null,  // IG total follower count not in account insights endpoint
      demographics: igDemographics,
    }),
    upsertAccountSnapshot({
      platform: "facebook",
      week_start: weekStartStr,
      reach: fbPage.reach,
      views: null,
      net_followers: null,    // FB net growth: WoW followers_count delta (blank week 1)
      engagement: fbPage.engagement,
      link_taps: null,
      followers_count: fbPage.followers_count,
      demographics: null,     // FB demographics unavailable
    }),
  ]);

  // ── 6. Native sweep — record any posts Meta knows about but we don't ──────
  await runNativeSweep({ igUserId, pageId, token, since, until });

  // ── 7. Compute the structured week payload ────────────────────────────────
  const payload = await computeWeek(weekStart);

  // Store payload now — so if Claude calls fail, the data is safe.
  await saveReportPayload(weekStartStr, payload);

  // ── 8. Generate Claude narratives (guarded by narratives_generated_at) ────
  await generateAndSaveNarratives(weekStartStr, payload);

  return NextResponse.json({ ok: true, week: weekStartStr });
}

// Generate and save both Claude narratives + the rule-based flag.
// Called in two places: fresh run and partial-recovery.
async function generateAndSaveNarratives(
  weekStartStr: string,
  payload: import("@/lib/report/compute-week").WeekPayload
): Promise<void> {
  try {
    const [win, recommend] = await Promise.all([
      generateWinNarrative(payload),
      generateRecommendNarrative(payload),
    ]);
    const flag = computeFlag(
      payload.posts,
      payload.igSnapshot,
      payload.priorIgSnapshot
    );
    await saveNarratives(weekStartStr, win, recommend, flag.text ?? "");
  } catch (err) {
    // Narrative failure must not break the cron — payload is already stored.
    console.error("[weekly-report] narrative generation failed:", err);
  }
}
