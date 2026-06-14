import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "stream";
import { getUserOrNull } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDriveClient } from "@/lib/drive/client";

export const runtime = "nodejs";
export const maxDuration = 60;

// Streams a video from Drive (as the owner, so her Google login doesn't matter).
// Default = inline, for playing in a <video> element; ?download=1 = attachment,
// for the "Save video" button. Forwards Range requests so playback seeks smoothly
// and only the needed bytes are pulled. [id] is the video's photo-row id.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const sb = createAdminClient();
  const { data: row } = await sb
    .from("photos")
    .select("drive_file_id, drive_name, category")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.category !== "videos") return new NextResponse("Not found", { status: 404 });

  const drive = createDriveClient();
  const meta = await drive.files.get({
    fileId: row.drive_file_id,
    fields: "mimeType, name",
    supportsAllDrives: true,
  });

  // Forward the browser's Range header to Drive so video scrubbing works.
  const range = request.headers.get("range");
  const res = await drive.files.get(
    { fileId: row.drive_file_id, alt: "media", supportsAllDrives: true },
    { responseType: "stream", headers: range ? { Range: range } : undefined }
  );
  const dh = res.headers as Record<string, string | undefined>;

  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const filename = (row.drive_name || meta.data.name || "video.mp4").replace(/"/g, "");
  const headers = new Headers();
  headers.set("Content-Type", meta.data.mimeType || "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  if (dh["content-length"]) headers.set("Content-Length", dh["content-length"]!);
  if (dh["content-range"]) headers.set("Content-Range", dh["content-range"]!);
  headers.set("Content-Disposition", wantsDownload ? `attachment; filename="${filename}"` : "inline");

  const body = Readable.toWeb(res.data as Readable) as ReadableStream;
  return new NextResponse(body, { status: res.status === 206 ? 206 : 200, headers });
}
