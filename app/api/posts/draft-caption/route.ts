import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { draftCaption } from "@/lib/process/draft-caption";
import { editCaption } from "@/lib/process/edit-caption";

export const runtime = "nodejs";

// Fires only on the "Draft caption" button — one Claude call per click.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { photoId, intent } = await request.json();
  if (typeof photoId !== "string") return new NextResponse("Bad request", { status: 400 });

  try {
    const raw = await draftCaption(photoId, typeof intent === "string" ? intent : undefined);
    const caption = await editCaption(raw); // second pass: de-AI-ify
    return NextResponse.json({ caption });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
