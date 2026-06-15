"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import type { Photo } from "@/lib/types";

interface Props {
  photo: Photo;
  onReclassify: (photo: Photo, category: string) => void;
  onUpdateTags: (photo: Photo, tags: string[]) => void;
  onRename?: (photo: Photo, name: string) => void;
  onTextSafeChange?: (photo: Photo, textSafe: boolean) => void;
  extraCount?: number;
  onExpand?: () => void;
}

export function PhotoTile({
  photo,
  onReclassify,
  onUpdateTags,
  onRename,
  onTextSafeChange,
  extraCount,
  onExpand,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState("");
  // Inline rename state: show the current display_name or fall back to drive_name.
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(
    photo.display_name ?? photo.drive_name ?? ""
  );
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

  function submitRename() {
    const trimmed = renameValue.trim();
    onRename?.(photo, trimmed);
    setRenaming(false);
  }

  // Visible name: prefer display_name set by user, then original filename.
  const visibleName = photo.display_name ?? photo.drive_name ?? null;

  // Only MinIO-backed photos have an original to download.
  const canDownload = photo.storage_backend === "minio" && !!photo.object_key;

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      {/* Thumbnails are pre-sized; serve them plainly, not through next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/thumb/${photo.id}`}
        alt={visibleName ?? "Venue photo"}
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

      {/* Tag button — opens the editor overlay. Shows a count if she's added tags. */}
      <button
        onClick={() => setEditing(true)}
        className="absolute bottom-12 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
      >
        🏷 {tags.length || "tag"}
      </button>

      {/* The category dropdown IS the correction control. */}
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

      {/* Tag editor: overlays the thumbnail. */}
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

          {/* Rename control: set a friendly display name. */}
          {onRename && (
            <div className="mt-2">
              {renaming ? (
                <div className="flex gap-1">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename();
                      if (e.key === "Escape") setRenaming(false);
                    }}
                    placeholder="Photo name…"
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                    autoFocus
                  />
                  <button
                    onClick={submitRename}
                    className="shrink-0 rounded bg-zinc-900 px-2 py-1 text-xs text-white"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="flex-1 truncate text-xs text-zinc-500">
                    {visibleName ? visibleName : <em className="text-zinc-400">no name</em>}
                  </span>
                  <button
                    onClick={() => {
                      setRenameValue(photo.display_name ?? photo.drive_name ?? "");
                      setRenaming(true);
                    }}
                    className="shrink-0 text-xs text-zinc-500 underline"
                  >
                    Rename
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Download original — only available for MinIO-backed photos. */}
          {canDownload && (
            <a
              href={`/api/download/${photo.id}`}
              className="mt-2 text-center text-xs text-zinc-600 underline"
              download
            >
              Download original
            </a>
          )}

          {/* Text-safe toggle: marks this photo as safe for graphic text overlay. */}
          {onTextSafeChange && (
            <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={photo.text_safe ?? false}
                onChange={(e) => onTextSafeChange(photo, e.target.checked)}
              />
              Safe for text overlay (graphic backgrounds)
            </label>
          )}
        </div>
      )}
    </div>
  );
}
