import { NextResponse, type NextRequest } from "next/server";
import { requireCredentials } from "@/lib/meta/client";
import { fetchIgAccountInsights, fetchFbPageInsights } from "@/lib/meta/account-insights";
import { upsertDailySnapshot } from "@/lib/db/daily-snapshots";
import { getRecentSnapshots } from "@/lib/db/weekly-snapshots";
import { getCurrentMondayChicago, toDateString } from "@/lib/report/compute-week";
import { createAdminClient } from "@/lib/supabase/admin";

// Node runtime required for Supabase admin client and Meta fetch.
export const runtime = "nodejs";
export const maxDuration = 60;

// Daily account-snapshot cron — records "this week so far" headline numbers.
//
// GUARDRAILS (non-negotiable):
//   1. No Claude / no LLM calls — daily = account numbers only.
//   2. No runNativeSweep — that's a weekly-only operation.
//   3. No syncInsights — post-level insight fetching is weekly-only.
//   4. Writes ONLY to daily_account_snapshots — NEVER weekly_account_snapshots or weekly_reports.
//   5. Upsert key = current-week Monday (getCurrentMondayChicago → toDateString), NEVER today's
//      date — the table stays at one row per platform per week, not one row per day.
//
// COST GUARD — freshness short-circuit (Guard 1):
//   After auth, check if a fresh IG row (updated_at > now() - 4 hours) already exists.
//   If yes, return { skipped: true } immediately with NO Meta calls.
//   This prevents retry storms and duplicate API calls from multiple triggers.
//
// Home-server crontab line (Walker adds this to the box):
//   # Daily live Insights numbers — ~6:10am Chicago
//   10 11 * * * curl -fsS -X GET https://<prod-domain>/api/cron/daily-snapshot -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
export async function GET(request: NextRequest) {
  // ── Auth gate (always first — before any DB or Meta calls) ───────────────
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ── Guard 1: freshness short-circuit (cost-watchdog required) ────────────
  // If an IG row was updated within the last 4 hours, skip all Meta calls.
  // Uses direct SQL via admin client because the Supabase JS filter syntax
  // for interval comparisons requires a raw query.
  try {
    const sb = createAdminClient();
    const weekStart = getCurrentMondayChicago();
    const weekStartStr = toDateString(weekStart);

    const { data: freshRow } = await sb
      .from("daily_account_snapshots")
      .select("id, updated_at")
      .eq("platform", "instagram")
      .eq("week_start", weekStartStr)
      .gt("updated_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (freshRow) {
      return NextResponse.json({ skipped: true, reason: "already_fresh", updated_at: freshRow.updated_at });
    }
  } catch {
    // If the table doesn't exist yet (migration not applied), skip the guard
    // and proceed — the upsert below will also fail gracefully.
  }

  // ── Get Meta credentials ──────────────────────────────────────────────────
  let creds: Awaited<ReturnType<typeof requireCredentials>>;
  try {
    creds = await requireCredentials();
  } catch {
    return NextResponse.json({ error: "Meta not connected" }, { status: 503 });
  }
  const token = creds.page_token as string;
  const igUserId = creds.ig_user_id as string;
  const pageId = creds.page_id as string;

  // ── Compute window: current week Monday 00:00 Chicago → now ──────────────
  const weekStart = getCurrentMondayChicago();
  const weekStartStr = toDateString(weekStart);
  // until = now (in-progress week, not a closed Mon–Sun window)
  const since = Math.floor(weekStart.getTime() / 1000);
  const until = Math.floor(Date.now() / 1000);

  // ── Fetch IG + FB in parallel (NO demographics, NO sweep, NO Claude) ─────
  const [igAccount, fbPage] = await Promise.all([
    fetchIgAccountInsights(igUserId, token, since, until),
    fetchFbPageInsights(pageId, token, since, until),
  ]);

  // ── Derive IG net_followers vs the most recent COMPLETED weekly snapshot ─
  // Read-only from weekly_account_snapshots — never write there.
  // "—"/null if no prior completed week exists.
  let igNetFollowers: number | null = null;
  try {
    const priorSnapshots = await getRecentSnapshots("instagram", 4);
    // Take the most recent completed week (any week_start, since daily rows aren't there).
    const priorSnap = priorSnapshots[0] ?? null;
    if (igAccount.followers_count != null && priorSnap?.followers_count != null) {
      igNetFollowers = igAccount.followers_count - priorSnap.followers_count;
    }
  } catch {
    // Non-fatal — net_followers stays null.
  }

  // ── Guard 2: upsert key is ALWAYS the current-week Monday ─────────────────
  // weekStartStr is derived from getCurrentMondayChicago() above, never new Date().
  // This guarantees the table has at most one row per platform per week.
  const capturedAt = new Date().toISOString();

  await Promise.all([
    upsertDailySnapshot({
      platform: "instagram",
      week_start: weekStartStr,
      reach: igAccount.reach,
      views: igAccount.views,
      net_followers: igNetFollowers,
      engagement: null,          // IG account-level engagement not available
      link_taps: igAccount.link_taps,
      followers_count: igAccount.followers_count,
      captured_at: capturedAt,
    }),
    upsertDailySnapshot({
      platform: "facebook",
      week_start: weekStartStr,
      reach: fbPage.reach,
      views: null,               // FB views not tracked at account level
      net_followers: null,       // FB net followers not derived here
      engagement: fbPage.engagement,
      link_taps: null,
      followers_count: fbPage.followers_count,
      captured_at: capturedAt,
    }),
  ]);

  return NextResponse.json({ ok: true, week_start: weekStartStr, captured_at: capturedAt });
}
