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

  // Hard-delete a photo: remove from local state immediately, call API.
  const deletePhoto = useCallback(async (photo: Photo) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    await fetch(`/api/photos/${photo.id}`, { method: "DELETE" }).catch(() => null);
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

      <div className="flex items-center justify-between px-4 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <span>
          {filtered.length} photos{filter !== "all" ? ` in ${labelFor(filter)}` : ""}
        </span>
        <div className="flex items-center gap-3">
          <UploadButton onComplete={() => { router.refresh(); setView("review"); }} />
          <Link href="/compose" className="underline" style={{ color: "var(--text-primary)" }}>New post</Link>
          <Link href="/create" className="underline" style={{ color: "var(--text-primary)" }}>Create graphic</Link>
          <Link href="/posts" className="underline" style={{ color: "var(--text-primary)" }}>Scheduled</Link>
          <Link href="/insights" className="underline" style={{ color: "var(--text-primary)" }}>Insights</Link>
        </div>
      </div>

      {/* Tab bar: Board / Review */}
      <div className="flex items-center gap-1 px-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={() => setView("board")}
          className="border-b-2 px-3 py-2 text-sm transition-colors"
          style={view === "board"
            ? { borderColor: "var(--gold)", fontWeight: 500, color: "var(--gold)" }
            : { borderColor: "transparent", color: "var(--text-dim)" }}
        >
          Board
        </button>
        <button
          onClick={() => setView("review")}
          className="border-b-2 px-3 py-2 text-sm transition-colors"
          style={view === "review"
            ? { borderColor: "var(--gold)", fontWeight: 500, color: "var(--gold)" }
            : { borderColor: "transparent", color: "var(--text-dim)" }}
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
                className="rounded px-2 py-1 text-xs transition-colors"
                style={activeRange === r.value
                  ? { background: "var(--gold)", color: "var(--bg)" }
                  : { color: "var(--text-dim)" }}
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
            <p className="px-4 py-16 text-center" style={{ color: "var(--text-dim)" }}>
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
                    onDelete={deletePhoto}
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
                className="rounded-md px-4 py-2 text-sm transition-colors"
                style={{
                  border: "1px solid var(--border-hi)",
                  color: "var(--text-secondary)",
                  background: "var(--surface)",
                }}
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
