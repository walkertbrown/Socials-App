import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { requireCredentials } from "@/lib/meta/client";
import { fetchIgAccountInsights, fetchFbPageInsights } from "@/lib/meta/account-insights";
import { getRecentSnapshots } from "@/lib/db/weekly-snapshots";
import { getCachedWindow, setCachedWindow } from "@/lib/db/account-window-cache";
import { windowRange, type WindowKey, type StripPayload } from "@/lib/report/window-ranges";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_WINDOWS: WindowKey[] = ["daily", "weekly", "monthly", "alltime"];

export async function GET(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const windowParam = searchParams.get("window");
  if (!windowParam || !VALID_WINDOWS.includes(windowParam as WindowKey)) {
    return new NextResponse("Bad request: window must be daily|weekly|monthly|alltime", { status: 400 });
  }
  const windowKey = windowParam as WindowKey;

  // Weekly data comes from the already-passed dailySnapshots server prop.
  // This route never handles weekly — the component uses the prop directly.
  if (windowKey === "weekly") {
    return new NextResponse("Bad request: weekly data is served from server props", { status: 400 });
  }

  if (windowKey === "alltime") {
    return handleAllTime();
  }

  return handleLiveWindow(windowKey);
}

// All-time: sum stored weekly_account_snapshots rows — no live Meta call.
async function handleAllTime(): Promise<NextResponse> {
  try {
    const [igRows, fbRows] = await Promise.all([
      getRecentSnapshots("instagram", 52),
      getRecentSnapshots("facebook", 52),
    ]);

    // Sum views and engagement across all stored weeks.
    let igViews = 0;
    let igViewsHasData = false;
    for (const row of igRows) {
      if (row.views != null) { igViews += row.views; igViewsHasData = true; }
    }

    let fbEngagement = 0;
    let fbEngagementHasData = false;
    for (const row of fbRows) {
      if (row.engagement != null) { fbEngagement += row.engagement; fbEngagementHasData = true; }
    }

    // Follower growth = latest followers_count minus earliest followers_count.
    // Rows are newest-first from getRecentSnapshots.
    const igLatest = igRows[0] ?? null;
    const igEarliest = igRows[igRows.length - 1] ?? null;
    let igNetFollowers: number | null = null;
    if (igLatest?.followers_count != null && igEarliest?.followers_count != null && igLatest !== igEarliest) {
      igNetFollowers = igLatest.followers_count - igEarliest.followers_count;
    }

    const fbLatest = fbRows[0] ?? null;
    const fbEarliest = fbRows[fbRows.length - 1] ?? null;
    let fbNetFollowers: number | null = null;
    if (fbLatest?.followers_count != null && fbEarliest?.followers_count != null && fbLatest !== fbEarliest) {
      fbNetFollowers = fbLatest.followers_count - fbEarliest.followers_count;
    }

    // Count IG posts published since Jun 1, 2026.
    let igPostsPublished: number | null = null;
    try {
      const sb = createAdminClient();
      const { count } = await sb
        .from("scheduled_posts")
        .select("*", { count: "exact", head: true })
        .eq("platform", "instagram")
        .in("status", ["published", "posted"])
        .gte("published_at", "2026-06-01T00:00:00.000Z");
      igPostsPublished = count ?? null;
    } catch {
      // Non-fatal — stays null.
    }

    const payload: StripPayload = {
      ig_reach: null,
      ig_views: igViewsHasData ? igViews : null,
      ig_followers_count: igLatest?.followers_count ?? null,
      ig_net_followers: igNetFollowers,
      ig_link_taps: null,
      fb_reach: null,
      fb_engagement: fbEngagementHasData ? fbEngagement : null,
      fb_followers_count: fbLatest?.followers_count ?? null,
      fb_net_followers: fbNetFollowers,
      ig_posts_published: igPostsPublished,
      fetched_at: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[insights/account] alltime error:", err);
    return NextResponse.json({ error: "Failed to compute all-time data" }, { status: 500 });
  }
}

// Daily or monthly: check cache, fall through to live Meta call on miss.
async function handleLiveWindow(windowKey: "daily" | "monthly"): Promise<NextResponse> {
  // Check cache for both platforms. If both are fresh, return the merged payload.
  const [igCached, fbCached] = await Promise.all([
    getCachedWindow("instagram", windowKey),
    getCachedWindow("facebook", windowKey),
  ]);

  if (igCached && fbCached) {
    const igPayload = igCached.payload as Partial<StripPayload>;
    const fbPayload = fbCached.payload as Partial<StripPayload>;
    const merged: StripPayload = {
      ig_reach: igPayload.ig_reach ?? null,
      ig_views: igPayload.ig_views ?? null,
      ig_followers_count: igPayload.ig_followers_count ?? null,
      ig_net_followers: igPayload.ig_net_followers ?? null,
      ig_link_taps: igPayload.ig_link_taps ?? null,
      fb_reach: fbPayload.fb_reach ?? null,
      fb_engagement: fbPayload.fb_engagement ?? null,
      fb_followers_count: fbPayload.fb_followers_count ?? null,
      fb_net_followers: null,
      ig_posts_published: null,
      fetched_at: igCached.fetched_at,
    };
    return NextResponse.json(merged);
  }

  // Cache miss — write sentinel rows BEFORE calling Meta so a concurrent request
  // finds something and returns the stale sentinel rather than triggering a second
  // Meta blast. This is the concurrent-miss guard required by cost-watchdog.
  const existingIgPayload = igCached?.payload ?? {};
  const existingFbPayload = fbCached?.payload ?? {};
  await Promise.all([
    setCachedWindow("instagram", windowKey, existingIgPayload),
    setCachedWindow("facebook", windowKey, existingFbPayload),
  ]);

  // Load Meta credentials.
  let creds: Awaited<ReturnType<typeof requireCredentials>>;
  try {
    creds = await requireCredentials();
  } catch {
    return NextResponse.json({ error: "Meta not connected" }, { status: 503 });
  }

  const token = creds.page_token as string;
  const igUserId = creds.ig_user_id as string;
  const pageId = creds.page_id as string;

  const range = windowRange(windowKey);

  // Fetch IG + FB in parallel — both never throw.
  const [igAccount, fbPage] = await Promise.all([
    fetchIgAccountInsights(igUserId, token, range.since, range.until),
    fetchFbPageInsights(pageId, token, range.since, range.until),
  ]);

  const fetchedAt = new Date().toISOString();

  // Build per-platform cache payloads, then write both.
  const igPayload = {
    ig_reach: igAccount.reach,
    ig_views: igAccount.views,
    ig_followers_count: igAccount.followers_count,
    ig_net_followers: null,
    ig_link_taps: igAccount.link_taps,
    fetched_at: fetchedAt,
  };
  const fbPayload = {
    fb_reach: fbPage.reach,
    fb_engagement: fbPage.engagement,
    fb_followers_count: fbPage.followers_count,
    fb_net_followers: null,
    fetched_at: fetchedAt,
  };

  await Promise.all([
    setCachedWindow("instagram", windowKey, igPayload),
    setCachedWindow("facebook", windowKey, fbPayload),
  ]);

  const result: StripPayload = {
    ig_reach: igAccount.reach,
    ig_views: igAccount.views,
    ig_followers_count: igAccount.followers_count,
    ig_net_followers: null,
    ig_link_taps: igAccount.link_taps,
    fb_reach: fbPage.reach,
    fb_engagement: fbPage.engagement,
    fb_followers_count: fbPage.followers_count,
    fb_net_followers: null,
    ig_posts_published: null,
    fetched_at: fetchedAt,
  };

  return NextResponse.json(result);
}
