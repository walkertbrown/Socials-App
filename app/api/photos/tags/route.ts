import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { setTags } from "@/lib/db/photos";

export const runtime = "nodejs";

// Save her manual tag edits for one photo (add/remove). She owns her library, so
// this overwrites the whole tag set with what the board sends.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id, tags } = await request.json();
  if (typeof id !== "string" || !Array.isArray(tags)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const saved = await setTags(id, tags.map(String));
    return NextResponse.json({ tags: saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
