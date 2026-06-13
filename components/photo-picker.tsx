"use client";

import { useState, useMemo } from "react";
import type { Photo } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

interface Props {
  photos: Photo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PhotoPicker({ photos, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(
    () => photos.filter((p) => filter === "all" || p.category === filter),
    [photos, filter]
  );
  const chips = [
    { key: "all", label: "All" },
    ...CATEGORIES.filter((c) => c.key !== "unsorted").map((c) => ({ key: c.key, label: c.label })),
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 pb-3">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === c.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`relative aspect-square overflow-hidden rounded-md border-2 ${
              selectedId === p.id ? "border-blue-600" : "border-transparent"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/thumb/${p.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
