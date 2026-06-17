import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { suggestHashtags } from "@/lib/process/suggest-hashtags";

export const runtime = "nodejs";

// POST { caption: string, photoId: string } → { tags: string[] }
//
// Fires only from the hashtag panel's debounced auto-suggest — not on every
// keystroke. Auth-gated (guard #8): no user, no call.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull(); // guard #8
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { caption, photoId } = await request.json();
  if (typeof caption !== "string" || typeof photoId !== "string") {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const tags = await suggestHashtags(caption, photoId);
    return NextResponse.json({ tags });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
