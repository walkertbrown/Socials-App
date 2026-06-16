import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReadyPhotos, getPendingReview } from "@/lib/db/photos";
import { BoardClient } from "@/app/board/board-client";

// Always render fresh — the board reflects per-user session + live data.
export const dynamic = "force-dynamic";

// The ?range= query param drives the date filter. Accepted values:
// "24h" | "7d" | "30d" | "all" (default: "all")
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

  return (
    <BoardClient
      initialPhotos={photos}
      initialPendingReview={pendingReview}
      userEmail={user.email ?? ""}
      activeRange={range ?? "all"}
    />
  );
}
