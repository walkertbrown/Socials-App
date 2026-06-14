import { NextResponse } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { refreshToken } from "@/lib/meta/refresh-token";

export const runtime = "nodejs";

export async function POST() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  try {
    return NextResponse.json(await refreshToken());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
