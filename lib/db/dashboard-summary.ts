import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingReview } from "@/lib/db/photos";

export interface DashboardSummary {
  pendingReviewCount: number;
  upcomingPostCount: number;
  latestInsightsWeek: string | null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const sb = createAdminClient();

  const [pendingReview, upcomingResult, insightsResult] = await Promise.all([
    getPendingReview(),
    sb
      .from("scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled"),
    sb
      .from("weekly_account_snapshots")
      .select("week_start")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    pendingReviewCount: pendingReview.length,
    upcomingPostCount: upcomingResult.count ?? 0,
    latestInsightsWeek: insightsResult.data?.week_start ?? null,
  };
}
