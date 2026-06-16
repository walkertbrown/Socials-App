"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PostGroup } from "@/lib/db/post-groups";
import { utcToCentral } from "@/lib/time";
import { EnableNotifications } from "@/components/enable-notifications";
import { PostGroupCard } from "@/components/post-group-card";
import { AppHeader } from "@/components/app-header";

export function PostsClient({ initialGroups, userEmail = "" }: { initialGroups: PostGroup[]; userEmail?: string }) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  useEffect(() => setGroups(initialGroups), [initialGroups]);

  const act = useCallback(
    async (id: string, action: "cancel" | "retry") => {
      await fetch(`/api/posts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).catch(() => {});
      router.refresh();
    },
    [router]
  );

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={userEmail} />
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1
          className="text-lg"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--text-primary)" }}
        >
          Scheduled posts
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <EnableNotifications />
          <Link
            href="/compose"
            className="rounded-md px-3 py-1 font-medium transition-colors hover:opacity-90"
            style={{ background: "var(--gold)", color: "var(--bg)" }}
          >
            New post
          </Link>
          <Link href="/create" className="underline" style={{ color: "var(--text-dim)" }}>
            Create graphic
          </Link>
          <Link href="/insights" className="underline" style={{ color: "var(--text-dim)" }}>
            Insights
          </Link>
          <Link href="/board" className="underline" style={{ color: "var(--text-dim)" }}>
            ← Board
          </Link>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="py-16 text-center" style={{ color: "var(--text-dim)" }}>No posts yet. Click &quot;New post.&quot;</p>
      )}

      {groups.map((g) => (
        <PostGroupCard key={g.post_group_id} group={g} onAct={act} />
      ))}
    </div>
    </div>
  );
}

// Keep the old single-post time display utility available for any remaining call
// sites during migration.
export { utcToCentral };
