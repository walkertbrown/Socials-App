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
  extraCount,
  onExpand,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    <div
      className="relative aspect-square overflow-hidden rounded-lg"
      style={{ border: "1px solid var(--border)", background: "var(--surface-hi)" }}
    >
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

      {/* The category dropdown IS the correction control. Keep gradient overlay dark so it works in both themes. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <select
          value={photo.category ?? "unsorted"}
          onChange={(e) => onReclassify(photo, e.target.value)}
          className="w-full rounded px-2 py-1 text-sm"
          style={{ background: "var(--surface)", color: "var(--text-primary)", border: "none" }}
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
              <span
                key={t}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{ background: "var(--surface-hi)", color: "var(--text-primary)" }}
              >
                {t}
                <button
                  onClick={() => removeTag(t)}
                  style={{ color: "var(--text-dim)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                >
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
              className="w-full rounded px-2 py-1 text-xs"
              style={{
                border: "1px solid var(--border-hi)",
                background: "var(--surface-hi)",
                color: "var(--text-primary)",
              }}
              autoFocus
            />
            <button
              onClick={addTag}
              className="shrink-0 rounded px-2 py-1 text-xs font-medium"
              style={{ background: "var(--gold)", color: "var(--bg)" }}
            >
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
                    className="w-full rounded px-2 py-1 text-xs"
                    style={{
                      border: "1px solid var(--border-hi)",
                      background: "var(--surface-hi)",
                      color: "var(--text-primary)",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={submitRename}
                    className="shrink-0 rounded px-2 py-1 text-xs font-medium"
                    style={{ background: "var(--gold)", color: "var(--bg)" }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="flex-1 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                    {visibleName ? visibleName : <em style={{ color: "var(--text-dim)" }}>no name</em>}
                  </span>
                  <button
                    onClick={() => {
                      setRenameValue(photo.display_name ?? photo.drive_name ?? "");
                      setRenaming(true);
                    }}
                    className="shrink-0 text-xs underline"
                    style={{ color: "var(--text-dim)" }}
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
              className="mt-2 text-center text-xs underline"
              style={{ color: "var(--text-secondary)" }}
              download
            >
              Download original
            </a>
          )}

          {/* Text-safe toggle: marks this photo as safe for graphic text overlay. */}
          {onTextSafeChange && (
            <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={photo.text_safe ?? false}
                onChange={(e) => onTextSafeChange(photo, e.target.checked)}
              />
              Safe for text overlay (graphic backgrounds)
            </label>
          )}

          {/* Delete photo */}
          {onDelete && (
            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border-hi)" }}>
              {confirmDelete ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => onDelete(photo)}
                    className="flex-1 rounded px-2 py-1 text-xs font-medium"
                    style={{ background: "var(--red)", color: "#fff" }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded px-2 py-1 text-xs"
                    style={{ background: "var(--surface-hi)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs underline"
                  style={{ color: "var(--text-dim)" }}
                >
                  Delete photo
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
