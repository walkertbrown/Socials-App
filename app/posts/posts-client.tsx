"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ScheduledPost } from "@/lib/db/posts";
import { utcToCentral } from "@/lib/time";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  publishing: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  canceled: "bg-zinc-200 text-zinc-500",
};

export function PostsClient({ initialPosts }: { initialPosts: ScheduledPost[] }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  useEffect(() => setPosts(initialPosts), [initialPosts]);

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
          <Link href="/compose" className="rounded-md bg-zinc-900 px-3 py-1 text-white">
            New post
          </Link>
          <Link href="/board" className="text-zinc-500 underline">
            ← Board
          </Link>
        </div>
      </div>

      {posts.length === 0 && (
        <p className="py-16 text-center text-zinc-400">No posts yet. Click “New post.”</p>
      )}

      {posts.map((p) => (
        <div key={p.id} className="flex gap-3 rounded-lg border border-zinc-200 p-3">
          {p.photo_id && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/thumb/${p.photo_id}`} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[p.status] ?? ""}`}>
                {p.status}
              </span>
              <span className="text-xs text-zinc-500">
                {utcToCentral(p.scheduled_at)} · {p.platforms.join(" + ")}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-700">
              {p.caption || <span className="text-zinc-400">No caption</span>}
            </p>
            {p.error && <p className="mt-1 text-xs text-red-600">{p.error}</p>}
          </div>
          <div className="flex flex-col gap-1">
            {p.status === "scheduled" && (
              <button onClick={() => act(p.id, "cancel")} className="text-xs text-zinc-500 underline">
                Cancel
              </button>
            )}
            {p.status === "failed" && (
              <button onClick={() => act(p.id, "retry")} className="text-xs text-blue-600 underline">
                Retry
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
