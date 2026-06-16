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
  onDelete?: (photo: Photo) => void;
  onTap?: (photo: Photo) => void;
  // Carousel selection mode: show this photo's position number (1-based), or 0 = not selected
  carouselIndex?: number;
  extraCount?: number;
  onExpand?: () => void;
}

export function PhotoTile({
  photo,
  onReclassify,
  onUpdateTags,
  onRename,
  onTextSafeChange,
  onDelete,
  onTap,
  carouselIndex = 0,
  extraCount,
  onExpand,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(
    photo.display_name ?? photo.drive_name ?? ""
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const visibleName = photo.display_name ?? photo.drive_name ?? null;
  const canDownload = photo.storage_backend === "minio" && !!photo.object_key;
  const inCarousel = carouselIndex > 0;

  return (
    <div
      className="relative aspect-square overflow-hidden rounded-lg"
      style={{
        border: inCarousel ? "2px solid var(--gold)" : "1px solid var(--border)",
        background: "var(--surface-hi)",
      }}
    >
      {/* Main image — tap opens action sheet (via onTap), unless tag editor is open */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumbnail_url ?? `/api/thumb/${photo.id}`}
        alt={visibleName ?? "Venue photo"}
        loading="lazy"
        className="h-full w-full object-cover"
        onClick={() => { if (!editing && onTap) onTap(photo); }}
        style={{ cursor: onTap ? "pointer" : "default" }}
      />

      {/* Carousel position badge */}
      {inCarousel && (
        <span
          className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: "var(--gold)", color: "var(--bg)" }}
        >
          {carouselIndex}
        </span>
      )}

      {extraCount ? (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
          className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
        >
          +{extraCount} similar
        </button>
      ) : null}

      {/* Tag button */}
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="absolute bottom-12 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
      >
        🏷 {tags.length || "tag"}
      </button>

      {/* Category select */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <select
          value={photo.category ?? "unsorted"}
          onChange={(e) => { e.stopPropagation(); onReclassify(photo, e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded px-2 py-1 text-sm"
          style={{ background: "var(--surface)", color: "var(--text-primary)", border: "none" }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Tag editor overlay */}
      {editing && (
        <div
          className="absolute inset-0 flex flex-col p-2"
          style={{ background: "var(--surface)", color: "var(--text-primary)" }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Tags</span>
            <button onClick={() => setEditing(false)} className="text-xs underline" style={{ color: "var(--text-dim)" }}>
              Done
            </button>
          </div>
          <div className="flex flex-1 flex-wrap content-start gap-1 overflow-y-auto">
            {tags.length === 0 && <span className="text-xs" style={{ color: "var(--text-dim)" }}>No tags yet.</span>}
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--surface-hi)", color: "var(--text-primary)" }}>
                {t}
                <button onClick={() => removeTag(t)} style={{ color: "var(--text-dim)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}>×</button>
              </span>
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add a name or tag…" className="w-full rounded px-2 py-1 text-xs"
              style={{ border: "1px solid var(--border-hi)", background: "var(--surface-hi)", color: "var(--text-primary)" }}
              autoFocus />
            <button onClick={addTag} className="shrink-0 rounded px-2 py-1 text-xs font-medium"
              style={{ background: "var(--gold)", color: "var(--bg)" }}>Add</button>
          </div>

          {onRename && (
            <div className="mt-2">
              {renaming ? (
                <div className="flex gap-1">
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(false); }}
                    placeholder="Photo name…" className="w-full rounded px-2 py-1 text-xs"
                    style={{ border: "1px solid var(--border-hi)", background: "var(--surface-hi)", color: "var(--text-primary)" }}
                    autoFocus />
                  <button onClick={submitRename} className="shrink-0 rounded px-2 py-1 text-xs font-medium"
                    style={{ background: "var(--gold)", color: "var(--bg)" }}>Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="flex-1 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                    {visibleName ? visibleName : <em style={{ color: "var(--text-dim)" }}>no name</em>}
                  </span>
                  <button onClick={() => { setRenameValue(photo.display_name ?? photo.drive_name ?? ""); setRenaming(true); }}
                    className="shrink-0 text-xs underline" style={{ color: "var(--text-dim)" }}>Rename</button>
                </div>
              )}
            </div>
          )}

          {canDownload && (
            <a href={`/api/download/${photo.id}`} className="mt-2 text-center text-xs underline"
              style={{ color: "var(--text-secondary)" }} download>Download original</a>
          )}

          {onTextSafeChange && (
            <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={photo.text_safe ?? false}
                onChange={(e) => onTextSafeChange(photo, e.target.checked)} />
              Safe for text overlay
            </label>
          )}

          {onDelete && (
            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border-hi)" }}>
              {confirmDelete ? (
                <div className="flex gap-1">
                  <button onClick={() => onDelete(photo)} className="flex-1 rounded px-2 py-1 text-xs font-medium"
                    style={{ background: "var(--red)", color: "#fff" }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="rounded px-2 py-1 text-xs"
                    style={{ background: "var(--surface-hi)", color: "var(--text-secondary)" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="text-xs underline"
                  style={{ color: "var(--text-dim)" }}>Delete photo</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
