import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReadyPhotos, getReadyVideos } from "@/lib/db/photos";
import { listGraphics } from "@/lib/db/graphics";
import { ComposeClient } from "@/app/compose/compose-client";

export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ graphicId?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const [photos, videos, graphics] = await Promise.all([
    getReadyPhotos(),
    getReadyVideos(),
    listGraphics(),
  ]);

  return (
    <ComposeClient
      photos={[...photos, ...videos]}
      graphics={graphics}
      preselectedGraphicId={params.graphicId ?? null}
      userEmail={user.email ?? ""}
    />
  );
}
