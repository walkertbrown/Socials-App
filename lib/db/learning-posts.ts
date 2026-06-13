import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Bounded corpus reads — never reuse listPosts() (that's unbounded).
// All queries here have hard LIMIT guards so one large post history
// can't blow the prompt budget.

export interface PostedCaption {
  id: string;
  caption: string;
  ai_draft: string | null;
  category: string | null;
  published_at: string | null;
  is_exemplar: boolean;
  // reach from post_insights (joined when available)
  reach: number | null;
}

// Recent captions she actually posted — the primary voice corpus source.
// Filters to published/posted status; caller can narrow by category.
// Default limit 10 per the spec; caller may ask for more (capped at 25).
export async function getPostedCaptions({
  category,
  limit = 10,
}: {
  category?: string;
  limit?: number;
} = {}): Promise<PostedCaption[]> {
  const cap = Math.min(limit, 25); // hard cap — never pull unlimited rows
  const sb = createAdminClient();

  let query = sb
    .from("scheduled_posts")
    .select(
      `id, caption, ai_draft, published_at, is_exemplar,
       photos!inner(category),
       post_insights(reach)`
    )
    .in("status", ["published", "posted"])
    .order("published_at", { ascending: false })
    .limit(cap);

  if (category) {
    // Filter by the related photo's category.
    query = query.eq("photos.category", category);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    caption: r.caption,
    ai_draft: r.ai_draft ?? null,
    category: r.photos?.category ?? null,
    published_at: r.published_at ?? null,
    is_exemplar: r.is_exemplar ?? false,
    reach: r.post_insights?.reach ?? null,
  }));
}

// Always-included exemplars (pinned by her via the ⭐ toggle).
// No limit argument — the set is small by definition (she picks these manually).
export async function getExemplarCaptions(): Promise<PostedCaption[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("scheduled_posts")
    .select(
      `id, caption, ai_draft, published_at, is_exemplar,
       photos!inner(category),
       post_insights(reach)`
    )
    .in("status", ["published", "posted"])
    .eq("is_exemplar", true)
    .order("published_at", { ascending: false })
    .limit(15); // exemplars are rare, 15 is a generous ceiling

  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    caption: r.caption,
    ai_draft: r.ai_draft ?? null,
    category: r.photos?.category ?? null,
    published_at: r.published_at ?? null,
    is_exemplar: true,
    reach: r.post_insights?.reach ?? null,
  }));
}
