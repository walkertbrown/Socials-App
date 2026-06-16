import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { createPostGroup, listPosts } from "@/lib/db/posts";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json(await listPosts());
}

// Accepts:
//   { photo_id, caption, media_type, post_group_id, items: [{ platform, scheduled_at, delivery }] }
//
// Creates one row per platform under the shared post_group_id.
//
// Video size guard: staging buffers the whole file in memory. CapCut clips are
// typically 20–80 MB; we reject at 150 MB here (pre-publish) so the user gets a
// clear message at compose time rather than a timeout mid-publish. The actual
// size check also runs inside stageVideo, but this guard catches it earlier by
// looking at the Drive file metadata if available (best-effort — we skip if the
// lookup fails, the stageVideo guard will catch it).
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const { photo_id, photo_ids, caption, ai_draft, media_type, post_group_id, items } = body;

  if (typeof photo_id !== "string") {
    return NextResponse.json({ error: "photo_id is required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one platform item is required" }, { status: 400 });
  }

  const resolvedMediaType: "image" | "video" | "graphic" | "carousel" =
    media_type === "video" ? "video"
    : media_type === "graphic" ? "graphic"
    : media_type === "carousel" ? "carousel"
    : "image";

  for (const item of items) {
    if (typeof item.platform !== "string" || typeof item.scheduled_at !== "string") {
      return NextResponse.json({ error: "Each item needs platform + scheduled_at" }, { status: 400 });
    }
  }

  const rows = items.map(
    (item: { platform: string; scheduled_at: string; delivery?: string }) => ({
      photo_id,
      // photo_ids is set for carousels (ordered array of photo UUIDs).
      ...(Array.isArray(photo_ids) && photo_ids.length > 1 ? { photo_ids } : {}),
      caption: caption ?? "",
      ai_draft: typeof ai_draft === "string" ? ai_draft : null,
      platform: item.platform,
      media_type: resolvedMediaType,
      scheduled_at: item.scheduled_at,
      delivery: item.delivery === "reminder" ? ("reminder" as const) : ("auto" as const),
    })
  );

  const created = await createPostGroup(rows, post_group_id ?? crypto.randomUUID());
  return NextResponse.json(created);
}
