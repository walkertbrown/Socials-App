import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { setExemplar } from "@/lib/db/posts";

export const runtime = "nodejs";

// Toggle the exemplar flag on a post.  Exemplar posts are always included in
// the voice corpus so the AI drafts in their style going forward.
//
// Body: { exemplar: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await request.json();

  if (typeof body.exemplar !== "boolean") {
    return new NextResponse("Bad request — exemplar must be boolean", { status: 400 });
  }

  await setExemplar(id, body.exemplar);
  return NextResponse.json({ ok: true, exemplar: body.exemplar });
}
