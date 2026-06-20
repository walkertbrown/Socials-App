import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resetSimulation } from "@/lib/db/outreach-schedule";

export const runtime = "nodejs";

// Undo a dry-run: un-consume 'simulated' drafts and reset their schedule rows to
// pending (real sends are never touched). Lets you re-preview or go live fresh.
export async function POST() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const result = await resetSimulation();
    return NextResponse.json(result);
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 500 });
  }
}
