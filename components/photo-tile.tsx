"use client";

import type { Photo } from "@/lib/types";

interface Props {
  photo: Photo;
  onTogglePick: (photo: Photo) => void;
  extraCount?: number;
  onExpand?: () => void;
}

export function PhotoTile({ photo, onTogglePick, extraCount, onExpand }: Props) {
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

      {photo.tags?.[0] && (
        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs capitalize text-white">
          {photo.tags[0]}
        </span>
      )}

      {extraCount ? (
        <button
          onClick={onExpand}
          className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
        >
          +{extraCount} similar
        </button>
      ) : null}

      <button
        onClick={() => onTogglePick(photo)}
        className={`absolute bottom-2 right-2 rounded-full px-3 py-1 text-sm font-medium shadow ${
          photo.picked ? "bg-emerald-500 text-white" : "bg-white/90 text-zinc-800"
        }`}
      >
        {photo.picked ? "✓ Picked" : "Pick"}
      </button>
    </div>
  );
}
