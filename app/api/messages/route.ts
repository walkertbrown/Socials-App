import { NextResponse } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getAllDmThreads } from "@/lib/db/dm-threads";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const threads = await getAllDmThreads();
  return NextResponse.json(threads);
}
