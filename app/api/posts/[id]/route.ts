import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { cancelPost, retryPost } from "@/lib/db/posts";

export const runtime = "nodejs";

// Cancel a still-scheduled post, or retry a failed one.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const { action } = await request.json();
  if (action === "cancel") await cancelPost(id);
  else if (action === "retry") await retryPost(id);
  else return new NextResponse("Bad request", { status: 400 });

  return NextResponse.json({ ok: true });
}
