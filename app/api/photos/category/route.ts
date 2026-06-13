import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { reclassifyPhoto } from "@/lib/process/reclassify";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id, category } = await request.json();
  if (typeof id !== "string" || typeof category !== "string") {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const result = await reclassifyPhoto(id, category);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
