import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReadyPhotos, getReadyVideos, batchSignThumbnails } from "@/lib/db/photos";
import { listGraphics } from "@/lib/db/graphics";
import { ComposeClient } from "@/app/compose/compose-client";

export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ graphicId?: string; photos?: string }>;
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

  const allPhotos = [...photos, ...videos];
  const thumbMap = await batchSignThumbnails(allPhotos);
  const photosWithUrls = allPhotos.map((p) => ({
    ...p,
    thumbnail_url: p.thumbnail_path ? (thumbMap.get(p.thumbnail_path) ?? null) : null,
  }));

  const preselectedPhotoIds = params.photos
    ? params.photos.split(",").filter(Boolean)
    : [];

  return (
    <ComposeClient
      photos={photosWithUrls}
      graphics={graphics}
      preselectedGraphicId={params.graphicId ?? null}
      preselectedPhotoIds={preselectedPhotoIds}
      userEmail={user.email ?? ""}
    />
  );
}
