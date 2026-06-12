import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReadyPhotos } from "@/lib/db/photos";
import { BoardClient } from "@/app/board/board-client";

// Always render fresh — the board reflects per-user session + live data.
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const photos = await getReadyPhotos();
  return <BoardClient initialPhotos={photos} userEmail={user.email ?? ""} />;
}
