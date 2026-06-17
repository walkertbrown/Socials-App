import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { processOnePhoto } from "@/lib/process/process-photo";

export const runtime = "nodejs";
export const maxDuration = 60;

// Processes exactly ONE photo per request (download -> thumbnail -> hash ->
// one vision tag). The client calls this sequentially for each pending photo.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await request.json();
  if (typeof id !== "string") {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const result = await processOnePhoto(id);
    return NextResponse.json(result);
  } catch (e) {
    // Surface the real failure in Vercel logs. The 500 body alone isn't captured
    // in the log stream, so failed photos otherwise show as blank-message 500s.
    console.error(`[process] photo ${id} failed:`, e);
    return NextResponse.json(
      { id, status: "error", message: (e as Error).message },
      { status: 500 }
    );
  }
}
