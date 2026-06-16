import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getSignedPutUrl } from "@/lib/storage/objects";
import { insertUploadPlaceholder, deletePhoto } from "@/lib/db/photos";

export const runtime = "nodejs";

// Returns a presigned PUT URL so the browser can upload directly to MinIO.
// Inserts a placeholder row first (status="processing") so /api/process has
// something to work with once the upload succeeds. If the insert fails the
// request fails cleanly with no side effects.
//
// Request body: { filename: string, contentType: string }
// Response:     { id: string, uploadUrl: string, objectKey: string }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.filename !== "string" || typeof body.contentType !== "string") {
    return new NextResponse("Bad request: filename and contentType required", { status: 400 });
  }

  const { filename, contentType } = body as { filename: string; contentType: string };

  // Only allow image and video content types — reject anything else.
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    return new NextResponse("Unsupported content type", { status: 422 });
  }

  // Build a flat, opaque key: uploads/{uuid}.{ext}
  // The original filename is preserved as drive_name in the DB for display.
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const uuid = randomUUID();
  const objectKey = `uploads/${uuid}.${ext}`;

  // Insert the placeholder row first so we have an id to return.
  let id: string;
  try {
    id = await insertUploadPlaceholder(objectKey, filename);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to create upload record: " + (e as Error).message },
      { status: 500 }
    );
  }

  // Get the presigned PUT URL. If this fails, clean up the placeholder row so
  // there's no orphan.
  let uploadUrl: string;
  try {
    uploadUrl = await getSignedPutUrl(objectKey, contentType);
  } catch (e) {
    await deletePhoto(id).catch(() => {}); // best-effort cleanup
    return NextResponse.json(
      { error: "Failed to generate upload URL: " + (e as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ id, uploadUrl, objectKey });
}
