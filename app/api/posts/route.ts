import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { createPost, listPosts } from "@/lib/db/posts";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json(await listPosts());
}

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { photo_id, caption, platforms, scheduled_at } = await request.json();
  if (typeof photo_id !== "string" || !Array.isArray(platforms) || typeof scheduled_at !== "string") {
    return new NextResponse("Bad request", { status: 400 });
  }
  if (!platforms.length) return NextResponse.json({ error: "Pick at least one platform" }, { status: 400 });

  const post = await createPost({ photo_id, caption: caption ?? "", platforms, scheduled_at });
  return NextResponse.json(post);
}
