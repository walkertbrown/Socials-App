import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedDownloadUrl } from "@/lib/storage/objects";

export const runtime = "nodejs";
export const maxDuration = 60;

// Auth-gated video URL. Builds a short-lived presigned MinIO URL and redirects
// the browser there so the app server never buffers the original bytes.
// Default = inline (for playing in a <video> element); ?download=1 = attachment.
// [id] is the video's photo-row id.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const sb = createAdminClient();
  const { data: row } = await sb
    .from("photos")
    .select("object_key, display_name, drive_name, category")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.category !== "videos") return new NextResponse("Not found", { status: 404 });
  if (!row.object_key) return new NextResponse("No object key for this video", { status: 400 });

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const filename = wantsDownload
    ? (row.display_name || row.drive_name || row.object_key.split("/").pop() || "video.mp4").replace(/"/g, "")
    : undefined;

  try {
    // inline=true omits attachment disposition so the browser can play the video;
    // inline=false + filename lets the browser save it with the right name.
    const url = await getSignedDownloadUrl(row.object_key, 600, filename, !wantsDownload);
    return NextResponse.redirect(url);
  } catch {
    return new NextResponse("Could not generate video URL.", { status: 500 });
  }
}
