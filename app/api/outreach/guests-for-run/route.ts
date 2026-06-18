// GET /api/outreach/guests-for-run?bucket=personalized|standard&limit=100&offset=0
// Returns a list of guest IDs for a run batch (verify + generate).
// The client passes these IDs sequentially to /api/outreach/verify and
// /api/outreach/generate. Offset enables "Generate next 100" continuation.
//
// Guards:
//   1. Auth-gated.
//   2. bucket required.
//   3. limit capped at 100 (plan hard-cap per run).

import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket");
  if (bucket !== "personalized" && bucket !== "standard") {
    return new NextResponse("bucket must be personalized or standard", { status: 400 });
  }

  const limit  = Math.min(parseInt(searchParams.get("limit")  ?? "100", 10), MAX_LIMIT);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const sb = createAdminClient();

  try {
    const { data, error } = await sb
      .from("guests")
      .select("id")
      .eq("marketing_opt_in", true)
      .eq("bucket", bucket)
      .order("guest_name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ ids: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (data ?? []).map((r: { id: string }) => r.id);
    return NextResponse.json({ ids });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
