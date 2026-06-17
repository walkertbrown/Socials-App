"use client";

// Scheduled posts list — sub-screen of Studio (back arrow, bottom tab stays).

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { PostGroup } from "@/lib/db/post-groups";
import { utcToCentral } from "@/lib/time";
import { EnableNotifications } from "@/components/enable-notifications";
import { PostGroupCard } from "@/components/post-group-card";

export function PostsClient({ initialGroups, userEmail: _userEmail = "" }: { initialGroups: PostGroup[]; userEmail?: string }) {
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
    <AppShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-4">

        {/* Back arrow — sub-screen of Studio */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 self-start text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text-dim)", background: "none", border: "none" }}
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          Studio
        </button>

        <div className="flex items-center justify-between">
          <h1
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 500, color: "var(--text-primary)" }}
          >
            Scheduled
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <EnableNotifications />
            <Link
              href="/compose"
              className="rounded-md px-3 py-1.5 font-medium transition-colors hover:opacity-90"
              style={{ background: "var(--gold)", color: "var(--on-accent)" }}
            >
              New post
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
    </AppShell>
  );
}

// Keep the old single-post time display utility available for any remaining call
// sites during migration.
export { utcToCentral };
