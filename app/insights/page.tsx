import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLatestReport, getReportByWeek, listReportWeeks } from "@/lib/db/weekly-reports";
import { getLatestDailySnapshots } from "@/lib/db/daily-snapshots";
import { InsightsClient } from "@/app/insights/insights-client";

export const dynamic = "force-dynamic";

// The insights page reads the stored weekly_reports row — NO compute on view.
// All data was assembled and stored by the weekly cron.
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { week: weekParam } = await searchParams;
  const availableWeeks = await listReportWeeks();

  // Load the requested week, or fall back to the most recent report.
  let report = null;
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    report = await getReportByWeek(weekParam);
  } else {
    report = await getLatestReport();
  }

  // Fetch daily "this week so far" snapshots (non-blocking — empty if not yet run).
  let dailySnapshots: Awaited<ReturnType<typeof getLatestDailySnapshots>> = [];
  try {
    dailySnapshots = await getLatestDailySnapshots();
  } catch {
    // Migration not applied yet or table absent — safe to show empty strip.
  }

  return (
    <InsightsClient
      report={report}
      availableWeeks={availableWeeks}
      userEmail={user.email ?? ""}
      dailySnapshots={dailySnapshots}
    />
  );
}
