"use client";

// PhotoActionSheet — bottom sheet shown when a photo tile is tapped.
// Extracted from board-client.tsx to keep that file under the 300-line ceiling.

import type { Photo } from "@/lib/types";

interface PhotoActionSheetProps {
  photo: Photo;
  onUseInPost: (photo: Photo) => void;
  onStartCarousel: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
  onClose: () => void;
}

export function PhotoActionSheet({
  photo,
  onUseInPost,
  onStartCarousel,
  onDelete,
  onClose,
}: PhotoActionSheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl p-4 pb-8"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
      >
        {/* Photo preview row */}
        <div className="mb-4 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/thumb/${photo.id}`}
            alt=""
            className="h-14 w-14 rounded-lg object-cover"
          />
          <span
            className="truncate text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {photo.display_name ?? photo.drive_name ?? "Photo"}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onUseInPost(photo)}
            className="w-full rounded py-3.5 text-sm font-semibold"
            style={{ background: "var(--gold)", color: "var(--on-accent)" }}
          >
            Use in post
          </button>
          <button
            onClick={() => onStartCarousel(photo)}
            className="w-full rounded py-3.5 text-sm font-semibold"
            style={{
              background: "var(--surface-hi)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-hi)",
            }}
          >
            Add to carousel
          </button>
          <button
            onClick={() => onDelete(photo)}
            className="w-full rounded py-3.5 text-sm font-semibold"
            style={{
              background: "var(--red-dim)",
              color: "var(--red)",
              border: "1px solid var(--red-dim)",
            }}
          >
            Delete photo
          </button>
          <button
            onClick={onClose}
            className="w-full rounded py-3 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
