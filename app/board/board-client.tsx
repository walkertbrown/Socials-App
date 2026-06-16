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

  // Action sheet: which photo was tapped
  const [actionPhoto, setActionPhoto] = useState<Photo | null>(null);

  // Carousel selection mode
  const [carouselIds, setCarouselIds] = useState<string[]>([]);
  const carouselMode = carouselIds.length > 0;

  const { progress, runSync } = useSync(useCallback(() => router.refresh(), [router]));
  useEffect(() => setPhotos(initialPhotos), [initialPhotos]);
  useEffect(() => setPendingCount(initialPendingReview.length), [initialPendingReview]);

  const filtered = useMemo(
    () => photos.filter((p) => filter === "all" || p.category === filter),
    [photos, filter]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const p of filtered) {
      const key = p.duplicate_group_id ?? p.id;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return Array.from(map.values());
  }, [filtered]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const reclassify = useCallback(async (photo: Photo, category: string) => {
    if (category === photo.category) return;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, category: category as CategoryKey } : p)));
    const res = await fetch("/api/photos/category", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, category }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, category: photo.category } : p)));
    } else {
      router.refresh();
    }
  }, [router]);

  const updateTags = useCallback(async (photo: Photo, tags: string[]) => {
    const prevTags = photo.tags ?? [];
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, tags } : p)));
    const res = await fetch("/api/photos/tags", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, tags }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, tags: prevTags } : p)));
    }
  }, []);

  const updateTextSafe = useCallback(async (photo: Photo, textSafe: boolean) => {
    const prev = photo.text_safe;
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, text_safe: textSafe } : p)));
    const res = await fetch("/api/photos/text-safe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, textSafe }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, text_safe: prev } : p)));
    }
  }, []);

  const renamePhoto = useCallback(async (photo: Photo, name: string) => {
    const prev = photo.display_name;
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, display_name: name || null } : p)));
    const res = await fetch("/api/photos/rename", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, name }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, display_name: prev } : p)));
    }
  }, []);

  const deletePhoto = useCallback(async (photo: Photo) => {
    setActionPhoto(null);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    await fetch(`/api/photos/${photo.id}`, { method: "DELETE" }).catch(() => null);
  }, []);

  // ── Tap handlers ──────────────────────────────────────────────────────────

  const handleTap = useCallback((photo: Photo) => {
    if (carouselMode) {
      // In carousel mode, tap toggles membership
      setCarouselIds((prev) =>
        prev.includes(photo.id) ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
      );
    } else {
      setActionPhoto(photo);
    }
  }, [carouselMode]);

  function useInPost(photo: Photo) {
    setActionPhoto(null);
    router.push(`/compose?photos=${photo.id}`);
  }

  function startCarousel(photo: Photo) {
    setActionPhoto(null);
    setCarouselIds([photo.id]);
  }

  function goToCompose() {
    router.push(`/compose?photos=${carouselIds.join(",")}`);
    setCarouselIds([]);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={userEmail} />
      <FilterBar active={filter} onChange={setFilter} onSync={runSync} progress={progress} />

      {/* Photo count + upload */}
      <div className="flex items-center justify-between px-4 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <span>{filtered.length} photos{filter !== "all" ? ` in ${labelFor(filter)}` : ""}</span>
        <UploadButton onComplete={() => { router.refresh(); setView("review"); }} />
      </div>

      {/* Tab bar: Board / Review */}
      <div className="flex items-center gap-1 px-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setView("board")} className="border-b-2 px-3 py-2 text-sm transition-colors"
          style={view === "board" ? { borderColor: "var(--gold)", fontWeight: 500, color: "var(--gold)" } : { borderColor: "transparent", color: "var(--text-dim)" }}>
          Board
        </button>
        <button onClick={() => setView("review")} className="border-b-2 px-3 py-2 text-sm transition-colors"
          style={view === "review" ? { borderColor: "var(--gold)", fontWeight: 500, color: "var(--gold)" } : { borderColor: "transparent", color: "var(--text-dim)" }}>
          Review{pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>

        {view === "board" && (
          <div className="ml-auto flex items-center gap-1 py-1">
            {DATE_RANGES.map((r) => (
              <Link key={r.value} href={r.value === "all" ? "/board" : `/board?range=${r.value}`}
                className="rounded px-2 py-1 text-xs transition-colors"
                style={activeRange === r.value ? { background: "var(--gold)", color: "var(--bg)" } : { color: "var(--text-dim)" }}>
                {r.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Review tab */}
      {view === "review" && (
        <ReviewView photos={initialPendingReview} onApproved={() => { setPendingCount((n) => Math.max(0, n - 1)); router.refresh(); }} />
      )}

      {/* Board tab */}
      {view === "board" && (
        <>
          {/* Carousel mode banner */}
          {carouselMode && (
            <div className="flex items-center justify-between px-4 py-2 text-sm" style={{ background: "var(--gold-dim)", borderBottom: "1px solid var(--gold-border)" }}>
              <span style={{ color: "var(--text-primary)" }}>
                {carouselIds.length} photo{carouselIds.length !== 1 ? "s" : ""} selected — tap more to add
              </span>
              <div className="flex gap-2">
                <button onClick={() => setCarouselIds([])} className="text-xs underline" style={{ color: "var(--text-dim)" }}>Cancel</button>
                <button onClick={goToCompose} className="rounded px-3 py-1 text-xs font-semibold"
                  style={{ background: "var(--gold)", color: "var(--bg)" }}>
                  Create carousel →
                </button>
              </div>
            </div>
          )}

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
                    onTap={handleTap}
                    carouselIndex={carouselIds.indexOf(p.id) + 1}
                    extraCount={!isOpen && idx === 0 && group.length > 1 ? group.length - 1 : undefined}
                    onExpand={() => setExpanded((s) => new Set(s).add(key))}
                  />
                ));
              })}
            </div>
          )}

          {visible < groups.length && (
            <div className="flex justify-center pb-8">
              <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className="rounded-md px-4 py-2 text-sm transition-colors"
                style={{ border: "1px solid var(--border-hi)", color: "var(--text-secondary)", background: "var(--surface)" }}>
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {/* Action sheet */}
      {actionPhoto && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setActionPhoto(null)} />
          {/* Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl p-4 pb-8" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
            {/* Photo preview row */}
            <div className="mb-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/thumb/${actionPhoto.id}`} alt="" className="h-14 w-14 rounded-lg object-cover" />
              <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {actionPhoto.display_name ?? actionPhoto.drive_name ?? "Photo"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => useInPost(actionPhoto)}
                className="w-full rounded-xl py-3.5 text-sm font-semibold"
                style={{ background: "var(--gold)", color: "var(--bg)" }}>
                Use in post
              </button>
              <button onClick={() => startCarousel(actionPhoto)}
                className="w-full rounded-xl py-3.5 text-sm font-semibold"
                style={{ background: "var(--surface-hi)", color: "var(--text-primary)", border: "1px solid var(--border-hi)" }}>
                Add to carousel
              </button>
              <button onClick={() => deletePhoto(actionPhoto)}
                className="w-full rounded-xl py-3.5 text-sm font-semibold"
                style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red-dim)" }}>
                Delete photo
              </button>
              <button onClick={() => setActionPhoto(null)}
                className="w-full rounded-xl py-3 text-sm"
                style={{ color: "var(--text-dim)" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
