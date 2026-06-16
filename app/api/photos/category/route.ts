import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { reclassifyPhoto } from "@/lib/process/reclassify";
import { setCategory } from "@/lib/db/photos";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id, category, status } = await request.json();
  if (typeof id !== "string" || typeof category !== "string") {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    // For pending_review photos the caller passes status="pending_review" so we
    // can re-derive the suggested display_name and return it for immediate UI update.
    if (status === "pending_review") {
      const suggestedName = await setCategory(id, category);
      return NextResponse.json({ id, category, suggestedName });
    }
    // Ready-board photos use the existing reclassify path (no name re-derivation).
    const result = await reclassifyPhoto(id, category);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
