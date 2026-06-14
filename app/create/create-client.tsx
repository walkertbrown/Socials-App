"use client";

// Create Graphic screen. Elizabeth types a prompt and style hint → AI picks a
// template and fills the slots → preview renders inline. She tweaks, saves to
// her library, and schedules via the existing compose flow.
//
// Cost guards enforced here:
//   - Generate button is disabled while a request is in flight (no concurrent renders).
//   - PNG is only written to the bucket on an explicit "Save" click.
//   - Regenerate similarly disabled while in-flight.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DesignSpec } from "@/lib/graphics/templates/types";
import { TEMPLATE_REGISTRY } from "@/lib/graphics/templates/registry";
import { TweakControls } from "./tweak-controls";

interface CreateClientProps {
  // Ids of text_safe photos — for the photo-swap control and passed to AI.
  textSafePhotoIds: string[];
}

export function CreateClient({ textSafePhotoIds }: CreateClientProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [styleHint, setStyleHint] = useState("");
  const [size, setSize] = useState<"feed" | "story">("feed");

  // Generating state.
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // After first generate: holds the current spec and preview PNG.
  const [spec, setSpec] = useState<DesignSpec | null>(null);
  const [pngBase64, setPngBase64] = useState<string | null>(null);

  // Tweak re-render state.
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  // Save state.
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The current template descriptor (resolved from spec.templateId).
  const template = spec
    ? TEMPLATE_REGISTRY.find((t) => t.id === spec.templateId) ?? null
    : null;

  // ── Generate ────────────────────────────────────────────────────────────────

  async function generate() {
    if (!prompt.trim()) return setGenerateError("Enter a prompt first.");
    setGenerating(true);
    setGenerateError(null);
    setSavedUrl(null);
    setSavedId(null);
    setSaveError(null);

    try {
      const res = await fetch("/api/graphics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, styleHint, size }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to generate");
      setSpec(d.spec);
      setPngBase64(d.pngBase64);
    } catch (e) {
      setGenerateError((e as Error).message);
    }
    setGenerating(false);
  }

  // ── Tweak + Regenerate ───────────────────────────────────────────────────────

  async function regenerate(updatedSpec: DesignSpec) {
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch("/api/graphics/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: updatedSpec }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Re-render failed");
      setPngBase64(d.pngBase64);
    } catch (e) {
      setRegenError((e as Error).message);
    }
    setRegenerating(false);
  }

  function handleSpecChange(updated: DesignSpec) {
    setSpec(updated);
  }

  function handleSizeToggle() {
    if (!spec) return;
    const newSize: "feed" | "story" = spec.size === "feed" ? "story" : "feed";
    const updated = { ...spec, size: newSize };
    setSpec(updated);
    setSize(newSize);
    // Auto re-render after size change so the preview is correct.
    regenerate(updated);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function save() {
    if (!spec) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/graphics/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setSavedUrl(d.url);
      setSavedId(d.graphicId);
    } catch (e) {
      setSaveError((e as Error).message);
    }
    setSaving(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isPortrait = spec?.size === "story";
  const previewMaxH = isPortrait ? "60vh" : "auto";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#1c3149]">Create Graphic</h1>
        <Link href="/board" className="text-sm text-zinc-500 underline">
          ← Board
        </Link>
      </div>

      {/* Prompt + size */}
      <section className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            What would you like to create?
          </label>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !generating && generate()}
            placeholder="e.g. happy pride from the Pelican Club, weekly happy hour reminder…"
            className="w-full rounded-md border border-zinc-300 p-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Style hint (optional)
          </label>
          <input
            value={styleHint}
            onChange={(e) => setStyleHint(e.target.value)}
            placeholder="e.g. dark moody background, script font, warm and festive…"
            className="w-full rounded-md border border-zinc-300 p-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {(["feed", "story"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  size === s ? "bg-[#1c3149] text-[#f3ecdd]" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {s === "feed" ? "Feed (1:1)" : "Story (9:16)"}
              </button>
            ))}
          </div>
          <button
            onClick={generate}
            disabled={generating || !prompt.trim()}
            className="ml-auto rounded-md bg-[#1c3149] px-5 py-2 text-sm font-medium text-[#f3ecdd] disabled:opacity-40"
          >
            {generating ? "Generating…" : spec ? "Regenerate" : "Generate"}
          </button>
        </div>
        {generateError && <p className="text-sm text-red-600">{generateError}</p>}
      </section>

      {/* Preview + tweak panel */}
      {spec && template && pngBase64 && (
        <div className="flex flex-col gap-5 sm:flex-row">
          {/* Preview */}
          <div className="flex flex-1 flex-col items-center gap-3">
            <p className="text-xs text-zinc-400">Preview — {spec.size}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${pngBase64}`}
              alt="Graphic preview"
              className="w-full rounded-lg shadow-lg"
              style={{ maxHeight: previewMaxH, objectFit: "contain" }}
            />
            {regenError && <p className="text-sm text-red-600">{regenError}</p>}

            {/* Save + schedule */}
            <div className="flex w-full flex-col gap-2">
              {!savedId ? (
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full rounded-md bg-[#e6b94d] px-4 py-2.5 text-sm font-semibold text-[#1c3149] disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save to library"}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-center text-sm font-medium text-emerald-700">
                    Saved! Schedule it like any post.
                  </p>
                  <Link
                    href={`/compose?graphicId=${savedId}`}
                    className="block w-full rounded-md bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white"
                  >
                    Schedule this graphic →
                  </Link>
                </div>
              )}
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </div>
          </div>

          {/* Tweak controls */}
          <div className="w-full sm:w-72 shrink-0">
            <TweakControls
              spec={spec}
              template={template}
              onSpecChange={handleSpecChange}
              textSafePhotoIds={textSafePhotoIds}
              onRegenerate={() => spec && regenerate(spec)}
              regenerating={regenerating}
              onSizeToggle={handleSizeToggle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
