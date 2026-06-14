import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { setTextSafe } from "@/lib/db/photos";

export const runtime = "nodejs";

// Toggle the text_safe flag on a photo. The board tag editor calls this when
// Elizabeth marks a photo as safe (or unsafe) for text overlay.
// Body: { id: string, textSafe: boolean }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id, textSafe } = await request.json();
  if (typeof id !== "string" || typeof textSafe !== "boolean") {
    return NextResponse.json(
      { error: "id (string) and textSafe (boolean) are required" },
      { status: 400 }
    );
  }

  await setTextSafe(id, textSafe);
  return NextResponse.json({ ok: true, id, textSafe });
}
