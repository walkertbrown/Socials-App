"use client";

import { CATEGORIES } from "@/lib/categories";
import type { Photo } from "@/lib/types";

interface Props {
  photo: Photo;
  onReclassify: (photo: Photo, category: string) => void;
  extraCount?: number;
  onExpand?: () => void;
}

export function PhotoTile({ photo, onReclassify, extraCount, onExpand }: Props) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      {/* Thumbnails are pre-sized; serve them plainly, not through next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/thumb/${photo.id}`}
        alt={photo.drive_name ?? "Venue photo"}
        loading="lazy"
        className="h-full w-full object-cover"
      />

      {extraCount ? (
        <button
          onClick={onExpand}
          className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
        >
          +{extraCount} similar
        </button>
      ) : null}

      {!photo.current_folder_id && (
        <span className="absolute left-2 top-2 rounded bg-amber-500/90 px-2 py-0.5 text-xs text-white">
          not moved
        </span>
      )}

      {/* The category dropdown IS the correction control: change it → the file moves. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <select
          value={photo.category ?? "unsorted"}
          onChange={(e) => onReclassify(photo, e.target.value)}
          className="w-full rounded bg-white/95 px-2 py-1 text-sm text-zinc-800"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
