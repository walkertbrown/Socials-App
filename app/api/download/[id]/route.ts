import { NextResponse } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getPhotoForStorage } from "@/lib/db/photos";
import { getSignedOriginalUrl } from "@/lib/storage/index";

export const runtime = "nodejs";

// Auth-gated original-download proxy. Builds a short-lived presigned MinIO URL
// and redirects the browser there so the app server never buffers the original bytes.
// The URL carries a Content-Disposition: attachment header so the browser downloads
// it rather than trying to preview it inline.
//
// This route only works for MinIO-backend photos. Legacy Drive photos return 400
// because we don't expose a Drive-download path (Drive serves them directly via oauth).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const photo = await getPhotoForStorage(id);
  if (!photo) return new NextResponse("Not found", { status: 404 });

  if (photo.storage_backend !== "minio" || !photo.object_key) {
    return new NextResponse(
      "Original download is only available for MinIO-backed photos.",
      { status: 400 }
    );
  }

  try {
    const url = await getSignedOriginalUrl(photo, 600);
    return NextResponse.redirect(url);
  } catch {
    return new NextResponse("Could not generate download URL.", { status: 500 });
  }
}
