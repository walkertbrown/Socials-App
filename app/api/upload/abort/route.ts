import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { deletePhoto } from "@/lib/db/photos";

export const runtime = "nodejs";

// Cleans up the placeholder row when a browser PUT to MinIO fails.
// Without this the row would sit forever at status="processing".
//
// Request body: { id: string }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return new NextResponse("Bad request: id required", { status: 400 });
  }

  await deletePhoto(body.id);
  return new NextResponse(null, { status: 204 });
}
