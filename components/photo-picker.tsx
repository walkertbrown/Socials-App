"use client";

import { useState, useMemo } from "react";
import type { Photo } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

interface Props {
  photos: Photo[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  // When set, show ONLY these photos in this order (intent-search results).
  matchedIds?: string[] | null;
  // When true, allow selecting multiple photos (carousel mode).
  multi?: boolean;
}

export function PhotoPicker({ photos, selectedIds, onSelect, matchedIds = null, multi = false }: Props) {
  const [filter, setFilter] = useState("all");

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const matchMode = matchedIds !== null;
  const filtered = useMemo(() => {
    if (matchMode) {
      return matchedIds!.map((id) => byId.get(id)).filter((p): p is Photo => !!p);
    }
    return photos.filter((p) => filter === "all" || p.category === filter);
  }, [matchMode, matchedIds, byId, photos, filter]);

  const hasVideos = useMemo(() => photos.some((p) => p.category === "videos"), [photos]);
  const chips = [
    { key: "all", label: "All" },
    ...CATEGORIES.filter((c) => c.key !== "unsorted").map((c) => ({ key: c.key, label: c.label })),
    ...(hasVideos ? [{ key: "videos", label: "▶ Videos" }] : []),
  ];

  function toggle(id: string) {
    if (!multi) {
      onSelect(selectedIds[0] === id ? [] : [id]);
      return;
    }
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter((s) => s !== id));
    } else {
      onSelect([...selectedIds, id]);
    }
  }

  return (
    <div>
      {!matchMode && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className="rounded-full px-3 py-1 text-xs transition-colors"
              style={
                filter === c.key
                  ? { background: "var(--gold)", color: "var(--bg)" }
                  : { background: "var(--surface-hi)", color: "var(--text-secondary)" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {multi && selectedIds.length > 0 && (
        <p className="mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          {selectedIds.length} photo{selectedIds.length > 1 ? "s" : ""} selected — tap to deselect
        </p>
      )}

      {matchMode && filtered.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--text-dim)" }}>
          No matches — clear the search to browse everything.
        </p>
      ) : (
        <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
          {filtered.map((p) => {
            const orderIndex = selectedIds.indexOf(p.id);
            const isSelected = orderIndex !== -1;
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className="relative aspect-square overflow-hidden rounded-md border-2 transition-colors"
                style={{
                  borderColor: isSelected ? "var(--gold)" : "transparent",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail_url ?? `/api/thumb/${p.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                {p.category === "videos" && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    ▶
                  </span>
                )}
                {/* Selection badge: order number for carousel, checkmark for single */}
                {isSelected && (
                  <span
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: "var(--gold)", color: "var(--bg)" }}
                  >
                    {multi ? orderIndex + 1 : "✓"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
