import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScheduledPost } from "@/lib/db/posts";

// A PostGroup is all the per-platform rows for one compose session, grouped
// for display. The dashboard shows one card per group, with per-platform lines.
export interface PostGroup {
  post_group_id: string;
  // All sibling rows under this group_id (one per platform).
  rows: ScheduledPost[];
  // Convenience fields derived from the first row (caption + photo are shared).
  photo_id: string | null;
  caption: string;
  media_type: "image" | "video" | "graphic" | "carousel";
  // Earliest scheduled_at among siblings (used for card-level sort).
  earliest_scheduled_at: string;
}

// Load all scheduled posts and group them by post_group_id.
// Rows without a group_id (legacy) each get their own single-row group using
// their own id as the group key, so the dashboard always receives PostGroups.
export async function listPostGroups(): Promise<PostGroup[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("scheduled_posts")
    .select("*")
    .order("scheduled_at", { ascending: true });

  const rows = (data ?? []) as ScheduledPost[];

  // Group by post_group_id; fall back to the row's own id for legacy rows.
  const map = new Map<string, ScheduledPost[]>();
  for (const row of rows) {
    const key = row.post_group_id ?? row.id;
    const existing = map.get(key);
    if (existing) {
      existing.push(row);
    } else {
      map.set(key, [row]);
    }
  }

  const groups: PostGroup[] = [];
  for (const [key, siblings] of map) {
    const first = siblings[0];
    // Sort siblings so they appear Instagram-first on the card.
    siblings.sort((a, b) => a.platform.localeCompare(b.platform));
    groups.push({
      post_group_id: key,
      rows: siblings,
      photo_id: first.photo_id,
      caption: first.caption,
      media_type: first.media_type,
      earliest_scheduled_at: siblings.reduce(
        (min, r) => (r.scheduled_at < min ? r.scheduled_at : min),
        first.scheduled_at
      ),
    });
  }

  // Sort groups by earliest scheduled time ascending.
  groups.sort((a, b) =>
    a.earliest_scheduled_at.localeCompare(b.earliest_scheduled_at)
  );

  return groups;
}
