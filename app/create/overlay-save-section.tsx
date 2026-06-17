"use client";

// OverlaySaveSection — text-overlay canvas + save button + post-save schedule
// link.  Shown after the user picks one of the two generated images.

import Link from "next/link";
import { TextOverlay } from "./text-overlay";

interface OverlaySaveSectionProps {
  pngBase64: string;
  format: "feed" | "story";
  modelName: string;
  saving: boolean;
  saveError: string | null;
  savedId: string | null;
  onPickDifferent: () => void;
  onSave: (pngBase64: string) => void;
}

export function OverlaySaveSection({
  pngBase64,
  format,
  modelName,
  saving,
  saveError,
  savedId,
  onPickDifferent,
  onSave,
}: OverlaySaveSectionProps) {
  if (savedId) {
    return (
      <section className="flex flex-col gap-2">
        <p
          className="text-center text-sm font-medium"
          style={{ color: "var(--green)" }}
        >
          Saved! Schedule it like any post.
        </p>
        <Link
          href={`/compose?graphicId=${savedId}`}
          className="block w-full rounded-md px-4 py-2.5 text-center text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: "var(--green)", color: "#0a2d14" }}
        >
          Schedule this graphic →
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {modelName} — add text overlay then save:
        </p>
        <button
          onClick={onPickDifferent}
          className="ml-auto text-xs underline"
          style={{ color: "var(--text-dim)" }}
        >
          ← Pick different image
        </button>
      </div>

      {saving && (
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Saving…
        </p>
      )}
      {saveError && (
        <p className="text-sm" style={{ color: "var(--red)" }}>
          {saveError}
        </p>
      )}

      <TextOverlay
        imageDataUrl={`data:image/png;base64,${pngBase64}`}
        format={format}
        onExport={onSave}
      />
    </section>
  );
}
