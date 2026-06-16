"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Photo } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { FilterBar } from "@/components/filter-bar";
import { PhotoTile } from "@/components/photo-tile";
import { useSync } from "@/lib/hooks/use-sync";
import { ReviewView } from "@/components/review-view";
import { UploadButton } from "@/components/upload-button";
import { labelFor, type CategoryKey } from "@/lib/categories";

const PAGE_SIZE = 50;
const DATE_RANGES = [
  { label: "Last 24h", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All", value: "all" },
] as const;

export function BoardClient({
  initialPhotos,
  initialPendingReview,
  userEmail,
  activeRange,
}: {
  initialPhotos: Photo[];
  initialPendingReview: Photo[];
  userEmail: string;
  activeRange: string;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [filter, setFilter] = useState<string>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"board" | "review">("board");
  const [pendingCount, setPendingCount] = useState(initialPendingReview.length);

  const { progress, runSync } = useSync(useCallback(() => router.refresh(), [router]));
  useEffect(() => setPhotos(initialPhotos), [initialPhotos]);
  useEffect(() => setPendingCount(initialPendingReview.length), [initialPendingReview]);

  const filtered = useMemo(
    () => photos.filter((p) => filter === "all" || p.category === filter),
    [photos, filter]
  );

  // Collapse near-duplicates: one representative per duplicate group.
  const groups = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const p of filtered) {
      const key = p.duplicate_group_id ?? p.id;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return Array.from(map.values());
  }, [filtered]);

  // Her correction: optimistically update, call the move endpoint, revert on failure.
  const reclassify = useCallback(
    async (photo: Photo, category: string) => {
      if (category === photo.category) return;
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, category: category as CategoryKey } : p))
      );
      const res = await fetch("/api/photos/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id, category }),
      }).catch(() => null);
      if (!res || !res.ok) {
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, category: photo.category } : p))
        );
      } else {
        router.refresh();
      }
    },
    [router]
  );

  // Her tag edits (e.g. adding a staff name): optimistically update, save, revert on failure.
  const updateTags = useCallback(
    async (photo: Photo, tags: string[]) => {
      const prevTags = photo.tags ?? [];
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, tags } : p)));
      const res = await fetch("/api/photos/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id, tags }),
      }).catch(() => null);
      if (!res || !res.ok) {
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, tags: prevTags } : p)));
      }
    },
    []
  );

  // Text-safe toggle: marks a photo as safe for graphic text overlay.
  // Optimistically updates; reverts on failure.
  const updateTextSafe = useCallback(async (photo: Photo, textSafe: boolean) => {
    const prev = photo.text_safe;
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, text_safe: textSafe } : p)));
    const res = await fetch("/api/photos/text-safe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, textSafe }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, text_safe: prev } : p)));
    }
  }, []);

  // Inline rename: optimistically updates display_name; reverts on failure.
  const renamePhoto = useCallback(async (photo: Photo, name: string) => {
    const prev = photo.display_name;
    setPhotos((ps) =>
      ps.map((p) => (p.id === photo.id ? { ...p, display_name: name || null } : p))
    );
    const res = await fetch("/api/photos/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, name }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setPhotos((ps) =>
        ps.map((p) => (p.id === photo.id ? { ...p, display_name: prev } : p))
      );
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={userEmail} />
      <FilterBar active={filter} onChange={setFilter} onSync={runSync} progress={progress} />

      <div className="flex items-center justify-between px-4 py-2 text-sm text-zinc-500">
        <span>
          {filtered.length} photos{filter !== "all" ? ` in ${labelFor(filter)}` : ""}
        </span>
        <div className="flex items-center gap-3">
          <UploadButton onComplete={() => { router.refresh(); setView("review"); }} />
          <Link href="/compose" className="text-zinc-700 underline">New post</Link>
          <Link href="/create" className="text-zinc-700 underline">Create graphic</Link>
          <Link href="/posts" className="text-zinc-700 underline">Scheduled</Link>
          <Link href="/insights" className="text-zinc-700 underline">Insights</Link>
        </div>
      </div>

      {/* Tab bar: Board / Review */}
      <div className="flex items-center gap-1 border-b border-zinc-200 px-4">
        <button
          onClick={() => setView("board")}
          className={`border-b-2 px-3 py-2 text-sm ${view === "board" ? "border-zinc-900 font-medium text-zinc-900" : "border-transparent text-zinc-500"}`}
        >
          Board
        </button>
        <button
          onClick={() => setView("review")}
          className={`border-b-2 px-3 py-2 text-sm ${view === "review" ? "border-zinc-900 font-medium text-zinc-900" : "border-transparent text-zinc-500"}`}
        >
          Review{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>

        {/* Date range filter -- only shown on the board tab */}
        {view === "board" && (
          <div className="ml-auto flex items-center gap-1 py-1">
            {DATE_RANGES.map((r) => (
              <Link
                key={r.value}
                href={r.value === "all" ? "/board" : `/board?range=${r.value}`}
                className={`rounded px-2 py-1 text-xs ${activeRange === r.value ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Review tab */}
      {view === "review" && (
        <ReviewView
          photos={initialPendingReview}
          onApproved={() => {
            setPendingCount((n) => Math.max(0, n - 1));
            router.refresh();
          }}
        />
      )}

      {/* Board tab */}
      {view === "board" && (
        <>
          {groups.length === 0 ? (
            <p className="px-4 py-16 text-center text-zinc-400">
              No photos yet. Click &quot;Sync &amp; sort&quot; to pull them in from Drive.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {groups.slice(0, visible).flatMap((group) => {
                const rep = group[0];
                const key = rep.duplicate_group_id ?? rep.id;
                const isOpen = expanded.has(key);
                const shown = isOpen ? group : [rep];
                return shown.map((p, idx) => (
                  <PhotoTile
                    key={p.id}
                    photo={p}
                    onReclassify={reclassify}
                    onUpdateTags={updateTags}
                    onRename={renamePhoto}
                    onTextSafeChange={updateTextSafe}
                    extraCount={!isOpen && idx === 0 && group.length > 1 ? group.length - 1 : undefined}
                    onExpand={() => setExpanded((s) => new Set(s).add(key))}
                  />
                ));
              })}
            </div>
          )}

          {visible < groups.length && (
            <div className="flex justify-center pb-8">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
