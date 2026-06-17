"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { Photo } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { ScreenEyebrow } from "@/components/screen-eyebrow";
import { FilterBar } from "@/components/filter-bar";
import { PhotoTile } from "@/components/photo-tile";
import { useSync } from "@/lib/hooks/use-sync";
import { ReviewView } from "@/components/review-view";
import { UploadButton } from "@/components/upload-button";
import { labelFor, type CategoryKey } from "@/lib/categories";
import { PhotoActionSheet } from "@/components/board/photo-action-sheet";

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
  userEmail: _userEmail,
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
  const [actionPhoto, setActionPhoto] = useState<Photo | null>(null);
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

  const reclassify = useCallback(async (photo: Photo, category: string) => {
    if (category === photo.category) return;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, category: category as CategoryKey } : p)));
    const res = await fetch("/api/photos/category", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, category }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, category: photo.category } : p)));
    } else { router.refresh(); }
  }, [router]);

  const updateTags = useCallback(async (photo: Photo, tags: string[]) => {
    const prevTags = photo.tags ?? [];
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, tags } : p)));
    const res = await fetch("/api/photos/tags", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, tags }),
    }).catch(() => null);
    if (!res || !res.ok) setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, tags: prevTags } : p)));
  }, []);

  const updateTextSafe = useCallback(async (photo: Photo, textSafe: boolean) => {
    const prev = photo.text_safe;
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, text_safe: textSafe } : p)));
    const res = await fetch("/api/photos/text-safe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, textSafe }),
    }).catch(() => null);
    if (!res || !res.ok) setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, text_safe: prev } : p)));
  }, []);

  const renamePhoto = useCallback(async (photo: Photo, name: string) => {
    const prev = photo.display_name;
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, display_name: name || null } : p)));
    const res = await fetch("/api/photos/rename", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, name }),
    }).catch(() => null);
    if (!res || !res.ok) setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, display_name: prev } : p)));
  }, []);

  const deletePhoto = useCallback(async (photo: Photo) => {
    setActionPhoto(null);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    await fetch(`/api/photos/${photo.id}`, { method: "DELETE" }).catch(() => null);
  }, []);

  const handleTap = useCallback((photo: Photo) => {
    if (carouselMode) {
      setCarouselIds((prev) =>
        prev.includes(photo.id) ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
      );
    } else {
      setActionPhoto(photo);
    }
  }, [carouselMode]);

  function useInPost(photo: Photo) { setActionPhoto(null); router.push(`/compose?photos=${photo.id}`); }
  function startCarousel(photo: Photo) { setActionPhoto(null); setCarouselIds([photo.id]); }
  function goToCompose() { router.push(`/compose?photos=${carouselIds.join(",")}`); setCarouselIds([]); }

  return (
    <AppShell>
      {/* Board eyebrow + Sync button */}
      <div className="mx-auto w-full max-w-xl px-4 pt-10">
        <div className="flex items-start justify-between">
          <ScreenEyebrow
            label="LIBRARY"
            title={`Board${filtered.length ? ` · ${filtered.length}` : ""}`}
          />
          <button
            onClick={runSync}
            disabled={progress !== null}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--surface-hi)", color: "var(--gold)", border: "1px solid var(--gold-border)" }}
          >
            <RefreshCw size={12} strokeWidth={2} className={progress !== null ? "animate-spin" : ""} />
            Sync
          </button>
        </div>
      </div>

      <FilterBar active={filter} onChange={setFilter} onSync={runSync} progress={progress} />

      {/* Photo count + upload */}
      <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>{filtered.length} photo{filtered.length !== 1 ? "s" : ""}{filter !== "all" ? ` in ${labelFor(filter)}` : ""}</span>
        <UploadButton onComplete={() => { router.refresh(); setView("review"); }} />
      </div>

      {/* Tab bar: Board / Review */}
      <div className="mx-auto flex w-full max-w-xl items-center gap-1 px-4" style={{ borderBottom: "1px solid var(--border)" }}>
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
                style={activeRange === r.value ? { background: "var(--gold)", color: "var(--on-accent)" } : { color: "var(--text-dim)" }}>
                {r.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {view === "review" && (
        <ReviewView photos={initialPendingReview} onApproved={() => { setPendingCount((n) => Math.max(0, n - 1)); router.refresh(); }} />
      )}

      {view === "board" && (
        <>
          {carouselMode && (
            <div className="flex items-center justify-between px-4 py-2 text-sm" style={{ background: "var(--gold-dim)", borderBottom: "1px solid var(--gold-border)" }}>
              <span style={{ color: "var(--text-primary)" }}>
                {carouselIds.length} photo{carouselIds.length !== 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2">
                <button onClick={() => setCarouselIds([])} className="text-xs underline" style={{ color: "var(--text-dim)" }}>Cancel</button>
                <button onClick={goToCompose} className="btn-teal rounded px-3 py-1 text-xs font-semibold">
                  Create carousel →
                </button>
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm" style={{ color: "var(--text-dim)" }}>
              No photos yet. Click &quot;Sync&quot; to pull them in from Drive.
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
              <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className="rounded px-4 py-2 text-sm transition-colors"
                style={{ border: "1px solid var(--border-hi)", color: "var(--text-secondary)", background: "var(--surface)" }}>
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {actionPhoto && (
        <PhotoActionSheet
          photo={actionPhoto}
          onUseInPost={useInPost}
          onStartCarousel={startCarousel}
          onDelete={deletePhoto}
          onClose={() => setActionPhoto(null)}
        />
      )}
    </AppShell>
  );
}
