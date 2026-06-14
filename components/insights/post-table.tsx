"use client";

// Per-format breakdown table + top posts list.
// "not enough data yet" shown when n < 5 per the sample gate.

import type { FormatRow } from "@/lib/report/format-breakdown";
import type { PostInsightsRow } from "@/lib/db/post-insights";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

interface FormatTableProps {
  rows: FormatRow[];
}

export function FormatTable({ rows }: FormatTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 text-sm font-medium text-zinc-700">Format Breakdown</div>
        <p className="text-sm text-zinc-400">No posts recorded for this week.</p>
        <p className="mt-1 text-xs text-zinc-400 italic">Stories not included (24h expiry).</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">Format Breakdown</span>
        <span className="text-xs italic text-zinc-400">Stories not included</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="pb-2 pr-4 font-medium">Format</th>
              <th className="pb-2 pr-4 text-right font-medium">Posts</th>
              <th className="pb-2 pr-4 text-right font-medium">Med. Reach</th>
              <th className="pb-2 pr-4 text-right font-medium">Med. Views</th>
              <th className="pb-2 pr-4 text-right font-medium">Likes</th>
              <th className="pb-2 text-right font-medium">Comments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.format} className="border-b border-zinc-100 last:border-0">
                <td className="py-2 pr-4 font-medium capitalize">{row.format}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{row.postCount}</td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {row.medianReach.ok
                    ? fmt(Math.round(row.medianReach.value))
                    : <span className="text-zinc-400">not enough data yet</span>}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {row.medianViews.ok
                    ? row.medianViews.value != null
                      ? fmt(Math.round(row.medianViews.value))
                      : "—"
                    : <span className="text-zinc-400">not enough data yet</span>}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{fmt(row.totalLikes)}</td>
                <td className="py-2 text-right tabular-nums">{fmt(row.totalComments)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PostListProps {
  posts: PostInsightsRow[];
}

// Top posts by reach — shows up to 5 with metrics.
export function TopPostList({ posts }: PostListProps) {
  const withReach = [...posts]
    .filter((p) => p.reach != null)
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
    .slice(0, 5);

  if (!withReach.length) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 text-sm font-medium text-zinc-700">Top Posts</div>
        <p className="text-sm text-zinc-400">No reach data available for this week.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 text-sm font-medium text-zinc-700">Top Posts by Reach</div>
      <div className="flex flex-col gap-3">
        {withReach.map((post) => (
          <div key={post.post_id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase text-zinc-400 shrink-0">
                    {post.platform ?? ""}
                  </span>
                  <span className="text-xs text-zinc-400 capitalize shrink-0">
                    {post.format ?? post.media_type ?? ""}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 line-clamp-2">{post.caption ?? "(no caption)"}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold tabular-nums">{fmt(post.reach)}</div>
                <div className="text-xs text-zinc-400">reach</div>
              </div>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-zinc-500 tabular-nums">
              {post.likes != null && <span>{fmt(post.likes)} likes</span>}
              {post.comments != null && <span>{fmt(post.comments)} comments</span>}
              {post.views != null && <span>{fmt(post.views)} views</span>}
              {post.saves != null && <span>{fmt(post.saves)} saves</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
