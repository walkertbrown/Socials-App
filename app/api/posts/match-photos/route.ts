import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { matchPhotosToIntent } from "@/lib/process/match-photos";

export const runtime = "nodejs";

// "What do you want to post about?" -> ranked photo ids. Most searches resolve
// with no AI call at all (keyword match over stored tags/descriptions).
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { intent } = await request.json();
  if (typeof intent !== "string") return new NextResponse("Bad request", { status: 400 });

  try {
    const ids = await matchPhotosToIntent(intent);
    return NextResponse.json({ ids });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
