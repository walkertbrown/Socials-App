// Per-format reach median and post counts — used in the weekly report table.
// Stories are excluded from v1 (24h expiry vs weekly sweep).

import {
  median,
  formatGate,
  groupByFormat,
  type GatedValue,
} from "@/lib/report/sample-gates";
import type { PostInsightsRow } from "@/lib/db/post-insights";

export interface FormatRow {
  format: string;
  postCount: number;
  // gated: "not enough data yet" when n < 5
  medianReach: GatedValue<number>;
  medianViews: GatedValue<number | null>;
  totalLikes: number;
  totalComments: number;
}

// Compute per-format breakdown for all posts in the week.
// Stories (format='story') are filtered out — their 24h lifespan means the
// weekly sweep won't capture complete metrics.
export function computeFormatBreakdown(posts: PostInsightsRow[]): FormatRow[] {
  // Exclude stories from v1 analysis.
  const eligible = posts.filter((p) => p.format !== "story");
  const byFormat = groupByFormat(eligible);

  const rows: FormatRow[] = [];
  for (const [format, formatPosts] of byFormat) {
    const n = formatPosts.length;

    const reaches = formatPosts
      .map((p) => p.reach)
      .filter((v): v is number => v != null);

    const views = formatPosts
      .map((p) => p.views)
      .filter((v): v is number => v != null);

    const totalLikes = formatPosts.reduce((s, p) => s + (p.likes ?? 0), 0);
    const totalComments = formatPosts.reduce((s, p) => s + (p.comments ?? 0), 0);

    rows.push({
      format,
      postCount: n,
      medianReach: formatGate(n, median(reaches) ?? 0),
      // Views only meaningful for reels/video — gate the same way but allow null
      medianViews: views.length > 0
        ? formatGate(n, median(views))
        : formatGate(n, null),
      totalLikes,
      totalComments,
    });
  }

  // Sort by post count descending so the most-used format is first.
  return rows.sort((a, b) => b.postCount - a.postCount);
}
