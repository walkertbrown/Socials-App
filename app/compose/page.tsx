import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReadyPhotos, getReadyVideos } from "@/lib/db/photos";
import { ComposeClient } from "@/app/compose/compose-client";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [photos, videos] = await Promise.all([getReadyPhotos(), getReadyVideos()]);
  return <ComposeClient photos={[...photos, ...videos]} />;
}
