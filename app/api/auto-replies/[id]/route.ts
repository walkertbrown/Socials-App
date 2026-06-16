import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { toggleRule, deleteRule } from "@/lib/db/auto-reply-rules";

export const runtime = "nodejs";

// PATCH: toggle active flag.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.active !== "boolean") {
    return new NextResponse("Bad request: active (boolean) required", { status: 400 });
  }

  await toggleRule(id, body.active);
  return NextResponse.json({ ok: true });
}

// DELETE: remove a rule.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  await deleteRule(id);
  return NextResponse.json({ ok: true });
}
