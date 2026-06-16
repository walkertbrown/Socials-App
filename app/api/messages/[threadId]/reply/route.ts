import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertDmMessageIfNew } from "@/lib/db/dm-threads";
import { sendDmReply } from "@/lib/meta/messaging";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { threadId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return new NextResponse("Bad request: text required", { status: 400 });
  }

  // Fetch the thread to get platform + raw Meta sender id.
  const sb = createAdminClient();
  const { data: thread } = await sb
    .from("dm_threads")
    .select("platform, thread_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return new NextResponse("Thread not found", { status: 404 });

  const platform = thread.platform as "instagram" | "facebook";
  // thread_id is stored as "{platform}:{sender_id}"
  const senderId = thread.thread_id.slice(platform.length + 1);

  const replyMid = await sendDmReply(platform, senderId, body.text.trim());

  await insertDmMessageIfNew({
    thread_id: threadId,
    platform_message_id: replyMid,
    direction: "outbound",
    body: body.text.trim(),
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
