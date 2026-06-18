import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGuestBucketCounts, getUpcomingOccasions } from "@/lib/db/guests";
import { OutreachClient } from "@/app/outreach/outreach-client";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Both calls degrade gracefully if the migration hasn't been applied yet.
  const [bucketCounts, occasions] = await Promise.all([
    getGuestBucketCounts(),
    getUpcomingOccasions(),
  ]);

  return <OutreachClient initialBucketCounts={bucketCounts} initialOccasions={occasions} />;
}
