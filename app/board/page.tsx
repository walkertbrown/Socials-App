import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReadyPhotos, getPendingReview, batchSignThumbnails } from "@/lib/db/photos";
import { BoardClient } from "@/app/board/board-client";

export const dynamic = "force-dynamic";

function rangeToDate(range: string | null): Date | undefined {
  if (!range || range === "all") return undefined;
  const now = new Date();
  if (range === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return undefined;
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { range } = await searchParams;
  const createdAfter = rangeToDate(range ?? null);

  const [photos, pendingReview] = await Promise.all([
    getReadyPhotos(createdAfter),
    getPendingReview(),
  ]);

  // Batch-sign all thumbnail URLs in one storage API call instead of one per image.
  // This replaces ~500 serverless invocations with a single request at render time.
  const [thumbMap, reviewThumbMap] = await Promise.all([
    batchSignThumbnails(photos),
    batchSignThumbnails(pendingReview),
  ]);

  const photosWithUrls = photos.map((p) => ({
    ...p,
    thumbnail_url: p.thumbnail_path ? (thumbMap.get(p.thumbnail_path) ?? null) : null,
  }));

  const reviewWithUrls = pendingReview.map((p) => ({
    ...p,
    thumbnail_url: p.thumbnail_path ? (reviewThumbMap.get(p.thumbnail_path) ?? null) : null,
  }));

  return (
    <BoardClient
      initialPhotos={photosWithUrls}
      initialPendingReview={reviewWithUrls}
      userEmail={user.email ?? ""}
      activeRange={range ?? "all"}
    />
  );
}
