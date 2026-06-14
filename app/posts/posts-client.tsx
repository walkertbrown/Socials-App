"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PostGroup } from "@/lib/db/post-groups";
import { utcToCentral } from "@/lib/time";
import { EnableNotifications } from "@/components/enable-notifications";
import { PostGroupCard } from "@/components/post-group-card";

export function PostsClient({ initialGroups }: { initialGroups: PostGroup[] }) {
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Scheduled posts</h1>
        <div className="flex items-center gap-3 text-sm">
          <EnableNotifications />
          <Link href="/compose" className="rounded-md bg-zinc-900 px-3 py-1 text-white">
            New post
          </Link>
          <Link href="/create" className="text-zinc-500 underline">
            Create graphic
          </Link>
          <Link href="/insights" className="text-zinc-500 underline">
            Insights
          </Link>
          <Link href="/board" className="text-zinc-500 underline">
            ← Board
          </Link>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="py-16 text-center text-zinc-400">No posts yet. Click "New post."</p>
      )}

      {groups.map((g) => (
        <PostGroupCard key={g.post_group_id} group={g} onAct={act} />
      ))}
    </div>
  );
}

// Keep the old single-post time display utility available for any remaining call
// sites during migration.
export { utcToCentral };
