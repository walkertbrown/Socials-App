"use client";

// MediaModePicker — toggles between "Photo or Video" and "Saved Graphic" post modes.
// Also contains the saved-graphic grid for when graphic mode is active.
// Extracted from compose-client.tsx to keep that file under the 300-line ceiling.

import Link from "next/link";
import type { Graphic } from "@/lib/types";

interface MediaModePickerProps {
  mediaMode: "photo" | "graphic";
  onModeChange: (mode: "photo" | "graphic") => void;
  graphics: Graphic[];
  selectedGraphicId: string | null;
  onSelectGraphic: (id: string) => void;
}

export function MediaModePicker({
  mediaMode,
  onModeChange,
  graphics,
  selectedGraphicId,
  onSelectGraphic,
}: MediaModePickerProps) {
  const selectedGraphic = graphics.find((g) => g.id === selectedGraphicId);

  return (
    <>
      {/* Mode pills */}
      <section>
        <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          1. What are you posting?
        </p>
        <div className="flex gap-2">
          {(["photo", "graphic"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className="rounded-full px-4 py-1.5 text-sm transition-colors"
              style={
                mediaMode === m
                  ? { background: "var(--gold)", color: "var(--on-accent)" }
                  : { background: "var(--surface-hi)", color: "var(--text-secondary)" }
              }
            >
              {m === "photo" ? "Photo or Video" : "Saved Graphic"}
            </button>
          ))}
        </div>
      </section>

      {/* Graphic grid — only when graphic mode is active */}
      {mediaMode === "graphic" && (
        <section>
          <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            2. Pick a saved graphic
          </p>
          {graphics.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              No saved graphics yet.{" "}
              <Link href="/create" className="underline" style={{ color: "var(--gold)" }}>
                Create one →
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {graphics.map((g) => {
                const src = g.png_path
                  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/graphics/${g.png_path}`
                  : null;
                return (
                  <button
                    key={g.id}
                    onClick={() => onSelectGraphic(g.id)}
                    className="relative aspect-square overflow-hidden rounded border-2 transition-colors"
                    style={{ borderColor: selectedGraphicId === g.id ? "var(--gold)" : "transparent" }}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="Graphic" className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="flex h-full items-center justify-center text-xs"
                        style={{ background: "var(--surface-hi)", color: "var(--text-dim)" }}
                      >
                        Graphic
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {g.size}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {selectedGraphic && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
              Selected: {selectedGraphic.size} graphic from{" "}
              {new Date(selectedGraphic.created_at).toLocaleDateString()}
            </p>
          )}
        </section>
      )}
    </>
  );
}
