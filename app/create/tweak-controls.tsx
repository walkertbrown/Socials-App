"use client";

// Tweak controls panel — shown after a graphic is generated.
// Lets Elizabeth edit text slots, swap font/palette/size, swap the background
// photo, and toggle feed vs story — all without leaving the page.
// Kept in its own file to stay under the 300-line ceiling.

import type { DesignSpec } from "@/lib/graphics/templates/types";
import type { GraphicTemplate } from "@/lib/graphics/templates/types";

interface TweakControlsProps {
  spec: DesignSpec;
  template: GraphicTemplate;
  onSpecChange: (updated: DesignSpec) => void;
  // Ids of text_safe photos for photo-background swap.
  textSafePhotoIds: string[];
  onRegenerate: () => void;
  regenerating: boolean;
  onSizeToggle: () => void;
}

export function TweakControls({
  spec,
  template,
  onSpecChange,
  textSafePhotoIds,
  onRegenerate,
  regenerating,
  onSizeToggle,
}: TweakControlsProps) {
  function updateSlot(key: string, value: string) {
    // No length clamping — the renderer auto-scales font size down for long copy.
    onSpecChange({ ...spec, slots: { ...spec.slots, [key]: value } });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Feed / Story toggle */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Format</p>
        <div className="flex gap-2">
          {(["feed", "story"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { if (spec.size !== s) onSizeToggle(); }}
              className="rounded-full px-4 py-1.5 text-sm transition-colors"
              style={
                spec.size === s
                  ? { background: "var(--gold)", color: "var(--bg)" }
                  : { background: "var(--surface-hi)", color: "var(--text-secondary)" }
              }
            >
              {s === "feed" ? "Feed (1:1)" : "Story (9:16)"}
            </button>
          ))}
        </div>
      </div>

      {/* Text slots */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Text</p>
        <div className="flex flex-col gap-3">
          {template.slots.map((slot) => {
            const val = spec.slots[slot.key] ?? "";
            // Skip the AI-only background slot — it's not user-editable.
            if (slot.key === "background") return null;
            return (
              <div key={slot.key}>
                <label className="mb-1 block text-xs" style={{ color: "var(--text-secondary)" }}>
                  {slot.label}
                  {slot.required && <span className="ml-1" style={{ color: "var(--red)" }}>*</span>}
                </label>
                <input
                  value={val}
                  onChange={(e) => updateSlot(slot.key, e.target.value)}
                  placeholder={slot.required ? "(required)" : "(optional)"}
                  className="w-full rounded-md p-2 text-sm"
                  style={{
                    border: "1px solid var(--border-hi)",
                    background: "var(--surface-hi)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Palette */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Color palette</p>
        <div className="flex flex-col gap-1.5">
          {template.palettes.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="palette"
                value={p.id}
                checked={spec.paletteId === p.id}
                onChange={() => onSpecChange({ ...spec, paletteId: p.id })}
              />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Font */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Font</p>
        <div className="flex flex-col gap-1.5">
          {template.fonts.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="font"
                value={f.id}
                checked={spec.fontId === f.id}
                onChange={() => onSpecChange({ ...spec, fontId: f.id })}
              />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Photo swap — only shown for photo-background templates */}
      {template.isPhotoBackground && textSafePhotoIds.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Background photo
          </p>
          <select
            value={spec.photoId ?? ""}
            onChange={(e) =>
              onSpecChange({ ...spec, photoId: e.target.value || null })
            }
            className="w-full rounded-md p-2 text-sm"
            style={{
              border: "1px solid var(--border-hi)",
              background: "var(--surface-hi)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">(none)</option>
            {textSafePhotoIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 8)}…
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Re-render */}
      <button
        onClick={onRegenerate}
        disabled={regenerating}
        className="rounded-md px-4 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-40"
        style={{
          border: "1px solid var(--gold-border)",
          color: "var(--gold)",
          background: "var(--gold-dim)",
        }}
      >
        {regenerating ? "Re-rendering…" : "Apply changes"}
      </button>
    </div>
  );
}
