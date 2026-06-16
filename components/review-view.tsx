"use client";

import { useState, useCallback, useEffect } from "react";
import { CATEGORIES, labelFor, isCategoryKey } from "@/lib/categories";
import { categoryToPrefix } from "@/lib/naming";
import type { Photo } from "@/lib/types";

interface Props {
  photos: Photo[];
  /** Called when one or more photos are approved so the parent can refresh. */
  onApproved: () => void;
}

// Review view: shows all pending_review photos so the user can inspect, edit
// category + name, and then approve individually or all at once.
// This is intentionally a separate component from the board — per the plan,
// the main board shows only "ready" photos.
export function ReviewView({ photos: initialPhotos, onApproved }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  // Sync when fresh server data arrives (e.g. after an upload + router.refresh).
  // Without this the list keeps its mount-time value and looks empty until a reload.
  useEffect(() => setPhotos(initialPhotos), [initialPhotos]);

  // Update local state when a field changes.
  function patchPhoto(id: string, patch: Partial<Photo>) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // Change category for one photo — re-derives suggested name on the server.
  const changeCategory = useCallback(async (id: string, category: string) => {
    if (!isCategoryKey(category)) return;
    patchPhoto(id, { category });
    try {
      const res = await fetch("/api/photos/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, category, status: "pending_review" }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.suggestedName) patchPhoto(id, { display_name: body.suggestedName });
      }
    } catch {
      // Non-fatal: optimistic update already applied.
    }
  }, []);

  // Rename (edit display_name) for one photo.
  const rename = useCallback(async (id: string, name: string) => {
    patchPhoto(id, { display_name: name || null });
    await fetch("/api/photos/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    }).catch(() => {});
  }, []);

  // Approve one photo: moves it to "ready" and removes it from this list.
  const approve = useCallback(
    async (id: string) => {
      setBusy((s) => new Set(s).add(id));
      try {
        const res = await fetch("/api/photos/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          setPhotos((prev) => prev.filter((p) => p.id !== id));
          onApproved();
        }
      } finally {
        setBusy((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [onApproved]
  );

  // Approve all currently listed photos.
  const approveAll = useCallback(async () => {
    const ids = photos.map((p) => p.id);
    for (const id of ids) {
      await approve(id);
    }
  }, [photos, approve]);

  if (photos.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-zinc-400">
        No photos pending review.
      </p>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-700">
          Review ({photos.length} photo{photos.length !== 1 ? "s" : ""})
        </h2>
        <button
          onClick={approveAll}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
        >
          Approve all
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {photos.map((photo) => (
          <ReviewTile
            key={photo.id}
            photo={photo}
            isBusy={busy.has(photo.id)}
            onCategoryChange={changeCategory}
            onRename={rename}
            onApprove={approve}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single tile ───────────────────────────────────────────────────────────────

interface TileProps {
  photo: Photo;
  isBusy: boolean;
  onCategoryChange: (id: string, category: string) => void;
  onRename: (id: string, name: string) => void;
  onApprove: (id: string) => void;
}

function ReviewTile({ photo, isBusy, onCategoryChange, onRename, onApprove }: TileProps) {
  const [nameVal, setNameVal] = useState(photo.display_name ?? photo.drive_name ?? "");
  const [editingName, setEditingName] = useState(false);

  const prefix = categoryToPrefix[photo.category ?? "unsorted"] ?? "UNSORTED";
  const destFolder = labelFor(photo.category ?? "unsorted");

  function submitRename() {
    onRename(photo.id, nameVal.trim());
    setEditingName(false);
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/thumb/${photo.id}`}
          alt={photo.display_name ?? photo.drive_name ?? "Pending photo"}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="text-xs text-zinc-500">Approving…</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-1.5 p-2">
        {/* Category selector */}
        <select
          value={photo.category ?? "unsorted"}
          onChange={(e) => onCategoryChange(photo.id, e.target.value)}
          className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-zinc-700"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Destination folder (read-only) */}
        <p className="text-xs text-zinc-400">
          → <span className="font-medium text-zinc-500">{destFolder}</span>
        </p>

        {/* Editable name */}
        {editingName ? (
          <div className="flex gap-1">
            <input
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="w-full rounded border border-zinc-300 px-1.5 py-1 text-xs"
              autoFocus
            />
            <button
              onClick={submitRename}
              className="shrink-0 rounded bg-zinc-900 px-2 py-1 text-xs text-white"
            >
              OK
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setNameVal(photo.display_name ?? photo.drive_name ?? ""); setEditingName(true); }}
            className="truncate text-left text-xs text-zinc-500 hover:underline"
            title={photo.display_name ?? photo.drive_name ?? ""}
          >
            {photo.display_name ?? photo.drive_name ?? <em className="text-zinc-400">no name</em>}
          </button>
        )}

        {/* Approve */}
        <button
          onClick={() => onApprove(photo.id)}
          disabled={isBusy}
          className="mt-0.5 rounded bg-zinc-900 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Approve
        </button>
      </div>
    </div>
  );
}
