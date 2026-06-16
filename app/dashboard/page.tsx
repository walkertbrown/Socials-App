import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardSummary } from "@/lib/db/dashboard-summary";
import { DashboardClient } from "@/app/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const summary = await getDashboardSummary();

  return <DashboardClient summary={summary} userEmail={user.email ?? ""} />;
}
