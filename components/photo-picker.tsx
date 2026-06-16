"use client";

import { useState, useMemo } from "react";
import type { Photo } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

interface Props {
  photos: Photo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  // When set, show ONLY these photos, in this order (intent-search results).
  // null = normal browse-and-filter mode.
  matchedIds?: string[] | null;
}

export function PhotoPicker({ photos, selectedId, onSelect, matchedIds = null }: Props) {
  const [filter, setFilter] = useState("all");

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  // Match mode: ranked subset, no category chips. Browse mode: category filter.
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
    ...(hasVideos ? [{ key: "videos", label: "🎬 Videos" }] : []),
  ];

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

      {matchMode && filtered.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--text-dim)" }}>
          No matches — clear the search to browse everything.
        </p>
      ) : (
        <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="relative aspect-square overflow-hidden rounded-md border-2 transition-colors"
              style={{
                borderColor: selectedId === p.id ? "var(--gold)" : "transparent",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/thumb/${p.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
              {p.category === "videos" && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                  ▶ video
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
