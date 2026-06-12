import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getThumbnailPath } from "@/lib/db/photos";

export const runtime = "nodejs";

// Auth-gated thumbnail proxy. The board's <img> tags point here, so a private
// thumbnail is only fetched for tiles that actually render (keeps egress low).
// We redirect to a short-lived signed URL rather than streaming the bytes.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const path = await getThumbnailPath(id);
  if (!path) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data } = await admin.storage
    .from("thumbnails")
    .createSignedUrl(path, 600);
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
