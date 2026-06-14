import "server-only";
import { graph } from "@/lib/meta/client";
import { createAdminClient } from "@/lib/supabase/admin";

// IG media_product_type values that map to post formats.
const FORMAT_MAP: Record<string, string> = {
  FEED: "image",
  REELS: "reel",
  STORY: "story",    // excluded from v1 analysis but recorded for completeness
  IGTV: "video",
};

// Classify the post format from Meta's media_product_type / media_type fields.
// Stories are recorded but marked for exclusion in the report layer.
function classifyFormat(mediaProductType?: string, mediaType?: string): string {
  if (mediaProductType && FORMAT_MAP[mediaProductType]) {
    return FORMAT_MAP[mediaProductType];
  }
  // Fallback by media_type.
  if (mediaType === "VIDEO") return "video";
  if (mediaType === "IMAGE") return "image";
  if (mediaType === "CAROUSEL_ALBUM") return "carousel";
  return "unknown";
}

export interface SweptPost {
  platform: "instagram" | "facebook";
  native_id: string;       // IG media id or FB post id
  format: string;
  published_at: string;
  caption: string | null;
}

// Sweep IG media for a Mon–Sun window (since/until Unix epoch seconds).
// The window gate is the cost guard — we never follow next-page cursors.
// Returns only posts that aren't already in scheduled_posts.
export async function sweepIgMedia(
  igUserId: string,
  token: string,
  since: number,
  until: number
): Promise<SweptPost[]> {
  try {
    const data = await graph(`${igUserId}/media`, {
      token,
      params: {
        fields: "id,media_type,media_product_type,timestamp,caption",
        since: String(since),
        until: String(until),
        // No cursor following — the since/until window is the backstop.
        limit: "50",
      },
    });

    const items: SweptPost[] = [];
    for (const m of (data?.data ?? [])) {
      items.push({
        platform: "instagram",
        native_id: m.id,
        format: classifyFormat(m.media_product_type, m.media_type),
        published_at: m.timestamp,
        caption: m.caption ?? null,
      });
    }
    return items;
  } catch {
    return [];
  }
}

// Sweep FB page posts for a Mon–Sun window (since/until Unix epoch seconds).
// No cursor following — window is the backstop.
export async function sweepFbPosts(
  pageId: string,
  token: string,
  since: number,
  until: number
): Promise<SweptPost[]> {
  try {
    const data = await graph(`${pageId}/posts`, {
      token,
      params: {
        fields: "id,message,created_time",
        since: String(since),
        until: String(until),
        limit: "50",
      },
    });

    const items: SweptPost[] = [];
    for (const p of (data?.data ?? [])) {
      items.push({
        platform: "facebook",
        native_id: p.id,
        format: "image",    // FB post format detection not available at sweep level
        published_at: p.created_time,
        caption: p.message ?? null,
      });
    }
    return items;
  } catch {
    return [];
  }
}

// Find which swept native_ids already exist in scheduled_posts so we can skip them.
// Checks both ig_post_id and fb_post_id columns.
async function findKnownIds(nativeIds: string[]): Promise<Set<string>> {
  if (!nativeIds.length) return new Set();
  const sb = createAdminClient();
  const [igResult, fbResult] = await Promise.all([
    sb.from("scheduled_posts").select("ig_post_id").in("ig_post_id", nativeIds),
    sb.from("scheduled_posts").select("fb_post_id").in("fb_post_id", nativeIds),
  ]);
  const known = new Set<string>();
  for (const r of igResult.data ?? []) if (r.ig_post_id) known.add(r.ig_post_id);
  for (const r of fbResult.data ?? []) if (r.fb_post_id) known.add(r.fb_post_id);
  return known;
}

// Run the full native sweep and INSERT unknown posts as source='native' placeholder rows.
// These rows have no photo_id / caption scheduled — they just register the post
// so the weekly report can count native vs composed content.
// Returns how many new native posts were recorded.
export async function runNativeSweep(opts: {
  igUserId: string;
  pageId: string;
  token: string;
  since: number;    // Unix seconds — Mon 00:00 Chicago
  until: number;    // Unix seconds — Sun 23:59:59 Chicago
}): Promise<number> {
  const [igPosts, fbPosts] = await Promise.all([
    sweepIgMedia(opts.igUserId, opts.token, opts.since, opts.until),
    sweepFbPosts(opts.pageId, opts.token, opts.since, opts.until),
  ]);

  const all = [...igPosts, ...fbPosts];
  if (!all.length) return 0;

  const allIds = all.map((p) => p.native_id);
  const known = await findKnownIds(allIds);

  // Filter to posts we haven't seen yet.
  const novel = all.filter((p) => !known.has(p.native_id));
  if (!novel.length) return 0;

  const sb = createAdminClient();

  // Insert as minimal scheduled_post rows with source='native'.
  // status='published' so insights sync picks them up; delivery='auto' is the
  // safe default (no action taken on published rows).
  const rows = novel.map((p) => ({
    platform: p.platform,
    caption: p.caption ?? "",
    media_type: "image" as const,        // unknown at sweep time; not material
    delivery: "auto" as const,
    status: "published",
    source: "native",
    published_at: p.published_at,
    scheduled_at: p.published_at,        // required not-null; use published_at
    // Store native id in the right column for insights sync to pick up.
    ...(p.platform === "instagram"
      ? { ig_post_id: p.native_id }
      : { fb_post_id: p.native_id }),
  }));

  const { data, error } = await sb
    .from("scheduled_posts")
    .insert(rows)
    .select("id");

  if (error) {
    // ON CONFLICT on ig/fb_post_id may not be set up — log and continue.
    console.error("[native-sweep] insert error:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}
