import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getDmMessages, clearUnreadCount } from "@/lib/db/dm-threads";

export const runtime = "nodejs";

// Returns messages for a thread and clears the unread count.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { threadId } = await params;
  const [messages] = await Promise.all([
    getDmMessages(threadId),
    clearUnreadCount(threadId),
  ]);

  return NextResponse.json(messages);
}
