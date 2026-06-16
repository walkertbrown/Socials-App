import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getAllRules, createRule } from "@/lib/db/auto-reply-rules";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const rules = await getAllRules();
  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.trigger_pattern !== "string" ||
    typeof body.reply_text !== "string" ||
    !body.trigger_pattern.trim() ||
    !body.reply_text.trim()
  ) {
    return new NextResponse("Bad request: trigger_pattern and reply_text required", { status: 400 });
  }

  const rule = await createRule({
    trigger_pattern: body.trigger_pattern.trim(),
    reply_text: body.reply_text.trim(),
  });
  return NextResponse.json(rule, { status: 201 });
}
