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
      <div
        className="rounded-lg p-4"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="mb-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Format Breakdown</div>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>No posts recorded for this week.</p>
        <p className="mt-1 text-xs italic" style={{ color: "var(--text-dim)" }}>Stories not included (24h expiry).</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-4"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Format Breakdown</span>
        <span className="text-xs italic" style={{ color: "var(--text-dim)" }}>Stories not included</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="pb-2 pr-4 font-medium" style={{ color: "var(--text-secondary)" }}>Format</th>
              <th className="pb-2 pr-4 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Posts</th>
              <th className="pb-2 pr-4 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Med. Reach</th>
              <th className="pb-2 pr-4 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Med. Views</th>
              <th className="pb-2 pr-4 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Likes</th>
              <th className="pb-2 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Comments</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.format} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4 font-medium capitalize" style={{ color: "var(--text-primary)" }}>{row.format}</td>
                <td className="py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{row.postCount}</td>
                <td className="py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {row.medianReach.ok
                    ? fmt(Math.round(row.medianReach.value))
                    : <span style={{ color: "var(--text-dim)" }}>not enough data yet</span>}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {row.medianViews.ok
                    ? row.medianViews.value != null
                      ? fmt(Math.round(row.medianViews.value))
                      : "—"
                    : <span style={{ color: "var(--text-dim)" }}>not enough data yet</span>}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(row.totalLikes)}</td>
                <td className="py-2 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmt(row.totalComments)}</td>
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
      <div
        className="rounded-lg p-4"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="mb-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Top Posts</div>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>No reach data available for this week.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-4"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>Top Posts by Reach</div>
      <div className="flex flex-col gap-3">
        {withReach.map((post) => (
          <div key={post.post_id} className="pb-3 last:pb-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase shrink-0" style={{ color: "var(--text-dim)" }}>
                    {post.platform ?? ""}
                  </span>
                  <span className="text-xs capitalize shrink-0" style={{ color: "var(--text-dim)" }}>
                    {post.format ?? post.media_type ?? ""}
                  </span>
                </div>
                <p className="text-sm line-clamp-2" style={{ color: "var(--text-primary)" }}>{post.caption ?? "(no caption)"}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold tabular-nums" style={{ color: "var(--gold)" }}>{fmt(post.reach)}</div>
                <div className="text-xs" style={{ color: "var(--text-dim)" }}>reach</div>
              </div>
            </div>
            <div className="mt-2 flex gap-4 text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
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
