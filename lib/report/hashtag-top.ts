// Top-3 hashtags by reach for the week's posts.
// Uses the post captions to extract hashtags and correlates with reach values.

import type { PostInsightsRow } from "@/lib/db/post-insights";

export interface HashtagResult {
  tag: string;
  medianReach: number;
  useCount: number;
}

function extractHashtags(caption: string | null): string[] {
  if (!caption) return [];
  return (caption.match(/#[\w]+/g) ?? []).map((t) => t.toLowerCase());
}

function medianOf(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Return the top 3 hashtags used in the week's posts, ranked by median reach
// of posts that included that tag. Requires reach data to be meaningful —
// tags with no reach data are excluded.
export function getTopHashtags(posts: PostInsightsRow[]): HashtagResult[] {
  const tagReach: Map<string, number[]> = new Map();

  for (const post of posts) {
    if (post.reach == null) continue;
    const tags = extractHashtags(post.caption);
    for (const tag of tags) {
      if (!tagReach.has(tag)) tagReach.set(tag, []);
      tagReach.get(tag)!.push(post.reach);
    }
  }

  const results: HashtagResult[] = [];
  for (const [tag, reaches] of tagReach) {
    results.push({
      tag,
      medianReach: medianOf(reaches),
      useCount: reaches.length,
    });
  }

  // Sort by median reach descending, then return top 3.
  return results.sort((a, b) => b.medianReach - a.medianReach).slice(0, 3);
}
