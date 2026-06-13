"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { Photo } from "@/lib/types";

interface Props {
  photo: Photo;
  onReclassify: (photo: Photo, category: string) => void;
  onUpdateTags: (photo: Photo, tags: string[]) => void;
  extraCount?: number;
  onExpand?: () => void;
}

export function PhotoTile({ photo, onReclassify, onUpdateTags, extraCount, onExpand }: Props) {
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState("");
  const tags = photo.tags ?? [];

  function addTag() {
    const t = newTag.trim();
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      onUpdateTags(photo, [...tags, t]);
    }
    setNewTag("");
  }

  function removeTag(tag: string) {
    onUpdateTags(photo, tags.filter((x) => x !== tag));
  }

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

      {/* Tag button — opens the editor overlay. Shows a count if she's added tags. */}
      <button
        onClick={() => setEditing(true)}
        className="absolute bottom-12 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
      >
        🏷 {tags.length || "tag"}
      </button>

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

      {/* Tag editor: overlays the thumbnail so there's room to type, even on mobile. */}
      {editing && (
        <div className="absolute inset-0 flex flex-col bg-white/97 p-2 text-zinc-800">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Tags</span>
            <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 underline">
              Done
            </button>
          </div>
          <div className="flex flex-1 flex-wrap content-start gap-1 overflow-y-auto">
            {tags.length === 0 && <span className="text-xs text-zinc-400">No tags yet.</span>}
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
                {t}
                <button onClick={() => removeTag(t)} className="text-zinc-400 hover:text-red-600">
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add a name or tag…"
              className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
              autoFocus
            />
            <button onClick={addTag} className="shrink-0 rounded bg-zinc-900 px-2 py-1 text-xs text-white">
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
