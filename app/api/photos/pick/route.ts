import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { setPicked } from "@/lib/db/photos";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id, picked } = await request.json();
  if (typeof id !== "string" || typeof picked !== "boolean") {
    return new NextResponse("Bad request", { status: 400 });
  }

  await setPicked(id, picked);
  return NextResponse.json({ ok: true });
}
