import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { deletePhoto } from "@/lib/db/photos";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Best-effort: delete thumbnail from storage before removing the DB row.
  try {
    const supabase = createAdminClient();
    const { data: photo } = await supabase
      .from("photos")
      .select("thumbnail_path, storage_backend, object_key")
      .eq("id", id)
      .single();

    if (photo?.thumbnail_path) {
      await supabase.storage.from("thumbnails").remove([photo.thumbnail_path]);
    }
  } catch {
    // Non-fatal — proceed to delete the row regardless.
  }

  await deletePhoto(id);
  return new NextResponse(null, { status: 204 });
}
