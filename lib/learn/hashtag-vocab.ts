import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Hashtag cap in prompts — big enough to give choices, small enough not to
// dominate the token budget.
const PROMPT_TAG_CAP = 20;

// Extract all lowercase hashtags from a caption string.
function extractHashtags(caption: string): string[] {
  return (caption.match(/#[\w]+/g) ?? []).map((t) => t.toLowerCase());
}

// Rebuild hashtag_vocab from all posted captions.
// Called from the cron maintenance step — not per draft, so the cost stays low.
export async function refreshHashtagVocab(): Promise<void> {
  const sb = createAdminClient();

  // Bounded read: only posted rows, most recent first, capped so a huge post
  // history doesn't make the cron step unbounded.
  const { data: posts, error } = await sb
    .from("scheduled_posts")
    .select("caption, photos!inner(category)")
    .in("status", ["published", "posted"])
    .order("published_at", { ascending: false })
    .limit(100);

  if (error || !posts?.length) return;

  // Accumulate tag → {category → count} and global → count.
  const counts: Map<string, Map<string | null, number>> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const post of posts as any[]) {
    const category: string | null = post.photos?.category ?? null;
    const tags = extractHashtags(post.caption ?? "");

    for (const tag of tags) {
      if (!counts.has(tag)) counts.set(tag, new Map());
      const catMap = counts.get(tag)!;

      // Track both the specific category and global (null) bucket.
      catMap.set(category, (catMap.get(category) ?? 0) + 1);
      catMap.set(null, (catMap.get(null) ?? 0) + 1);
    }
  }

  // Upsert into hashtag_vocab.  One row per (tag, category) pair.
  const now = new Date().toISOString();
  const rows: Array<{
    tag: string;
    category: string | null;
    use_count: number;
    last_used_at: string;
  }> = [];

  for (const [tag, catMap] of counts) {
    for (const [cat, count] of catMap) {
      rows.push({ tag, category: cat, use_count: count, last_used_at: now });
    }
  }

  if (!rows.length) return;

  // Upsert in small batches to avoid huge payloads.
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    await sb
      .from("hashtag_vocab")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "tag,category" });
  }
}

// Return the top N tags for a given category (falls back to global if thin).
// Used in the caption prompt so the model prefers real tags she actually uses.
export async function getTopHashtags(
  category?: string | null,
  n: number = PROMPT_TAG_CAP
): Promise<string[]> {
  const cap = Math.min(n, PROMPT_TAG_CAP); // enforce the cap — caller can't exceed it
  const sb = createAdminClient();

  let rows: { tag: string }[] = [];

  // Category-specific first.
  if (category) {
    const { data } = await sb
      .from("hashtag_vocab")
      .select("tag")
      .eq("category", category)
      .order("use_count", { ascending: false })
      .limit(cap);
    rows = data ?? [];
  }

  // Top-up with global if category didn't fill the cap.
  if (rows.length < cap) {
    const { data } = await sb
      .from("hashtag_vocab")
      .select("tag")
      .is("category", null)
      .order("use_count", { ascending: false })
      .limit(cap);

    const existing = new Set(rows.map((r) => r.tag));
    for (const r of data ?? []) {
      if (!existing.has(r.tag) && rows.length < cap) {
        rows.push(r);
      }
    }
  }

  return rows.map((r) => r.tag);
}
