"use client";

// Create Graphic screen — new image-gen pipeline.
//
// Flow: prompt + format → Generate (Claude enhances, two models run in parallel)
// → side-by-side results → pick one → optional text overlay (canvas, real-time)
// → Save → "Schedule this graphic →" link.
//
// Cost guards enforced here:
//   - Generate button is disabled while in-flight.
//   - The enhanced prompt is cached in state and sent back on repeated Generate
//     calls with the same prompt text, skipping the Sonnet enhancement call.
//   - PNG is written to the bucket only on an explicit Save click.

import { useState } from "react";
import Link from "next/link";
import { TextOverlay } from "./text-overlay";
import { AppHeader } from "@/components/app-header";

interface GenerateResult {
  model: string;
  ok: boolean;
  pngBase64?: string;
  error?: string;
}

interface CreateClientProps {
  userEmail?: string;
}

export function CreateClient({ userEmail = "" }: CreateClientProps) {
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<"feed" | "story">("feed");

  // Generating state.
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // After generate: results from both models + the enhanced prompt for caching.
  const [results, setResults] = useState<GenerateResult[] | null>(null);
  // Cache the enhanced prompt so repeated Generate calls with the same text
  // skip the Sonnet step (server route checks for this).
  const [cachedEnhancedPrompt, setCachedEnhancedPrompt] = useState<string>("");
  // Track the prompt text that produced the cached enhanced prompt.
  const [cachedForPrompt, setCachedForPrompt] = useState<string>("");

  // Which model's image the user selected for overlay/save.
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Save state.
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Generate ────────────────────────────────────────────────────────────────

  async function generate() {
    if (!prompt.trim()) return setGenerateError("Enter a prompt first.");
    setGenerating(true);
    setGenerateError(null);
    setResults(null);
    setSelectedModel(null);
    setSavedId(null);
    setSaveError(null);

    // Reuse the cached enhanced prompt if the user hasn't changed the text.
    const promptUnchanged = prompt.trim() === cachedForPrompt && !!cachedEnhancedPrompt;

    try {
      const res = await fetch("/api/graphics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          format,
          enhancedPrompt: promptUnchanged ? cachedEnhancedPrompt : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Generation failed");
      setResults(d.results);
      // Cache the enhanced prompt returned by the server.
      if (d.enhancedPrompt) {
        setCachedEnhancedPrompt(d.enhancedPrompt);
        setCachedForPrompt(prompt.trim());
      }
    } catch (e) {
      setGenerateError((e as Error).message);
    }
    setGenerating(false);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave(pngBase64: string) {
    if (!selectedModel) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/graphics/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pngBase64,
          format,
          model: selectedModel,
          enhancedPrompt: cachedEnhancedPrompt,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setSavedId(d.graphicId);
    } catch (e) {
      setSaveError((e as Error).message);
    }
    setSaving(false);
  }

  // Resolve the selected result for the overlay.
  const selectedResult = results?.find((r) => r.model === selectedModel && r.ok);

  const modelLabel: Record<string, string> = {
    "nano-banana-2": "Nano Banana 2",
    "gpt-image-2": "GPT Image 2",
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={userEmail} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1
            className="text-lg"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--text-primary)" }}
          >
            Create Graphic
          </h1>
          <Link href="/board" className="text-sm underline" style={{ color: "var(--text-dim)" }}>
            ← Board
          </Link>
        </div>

        {/* Prompt + format + generate */}
        <section className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              What would you like to create?
            </label>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !generating && generate()}
              placeholder="e.g. happy pride month, weekly happy hour reminder…"
              className="w-full rounded-md p-2 text-sm"
              style={{
                border: "1px solid var(--border-hi)",
                background: "var(--surface-hi)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Format toggle */}
            <div className="flex gap-2">
              {(["feed", "story"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className="rounded-full px-4 py-1.5 text-sm transition-colors"
                  style={
                    format === f
                      ? { background: "var(--gold)", color: "var(--bg)" }
                      : { background: "var(--surface-hi)", color: "var(--text-secondary)" }
                  }
                >
                  {f === "feed" ? "Feed (1:1)" : "Story (9:16)"}
                </button>
              ))}
            </div>
            <button
              onClick={generate}
              disabled={generating || !prompt.trim()}
              className="ml-auto rounded-md px-5 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--gold)", color: "var(--bg)" }}
            >
              {generating ? "Generating…" : results ? "Regenerate" : "Generate"}
            </button>
          </div>

          {generating && (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Calling both image models in parallel — this can take up to 60 s…
            </p>
          )}
          {generateError && (
            <p className="text-sm" style={{ color: "var(--red)" }}>{generateError}</p>
          )}
        </section>

        {/* Side-by-side results */}
        {results && !selectedModel && (
          <section className="flex flex-col gap-4">
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Pick an image to continue:
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {results.map((r) => (
                <div key={r.model} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold" style={{ color: "var(--gold)" }}>
                    {modelLabel[r.model] ?? r.model}
                  </p>
                  {r.ok && r.pngBase64 ? (
                    <button
                      onClick={() => setSelectedModel(r.model)}
                      className="w-full rounded-lg overflow-hidden transition-opacity hover:opacity-90 focus:outline-none"
                      style={{ border: "2px solid var(--border-hi)" }}
                      aria-label={`Select ${modelLabel[r.model] ?? r.model}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${r.pngBase64}`}
                        alt={`${modelLabel[r.model] ?? r.model} result`}
                        className="w-full"
                      />
                    </button>
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-lg p-6 text-sm"
                      style={{ background: "var(--surface-hi)", color: "var(--red)", minHeight: 160 }}
                    >
                      {r.error ?? "Generation failed"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Text overlay + save */}
        {selectedResult && selectedResult.pngBase64 && !savedId && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                {modelLabel[selectedResult.model] ?? selectedResult.model} — add text overlay then save:
              </p>
              <button
                onClick={() => setSelectedModel(null)}
                className="ml-auto text-xs underline"
                style={{ color: "var(--text-dim)" }}
              >
                ← Pick different image
              </button>
            </div>
            {saving && (
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>Saving…</p>
            )}
            {saveError && (
              <p className="text-sm" style={{ color: "var(--red)" }}>{saveError}</p>
            )}
            <TextOverlay
              imageDataUrl={`data:image/png;base64,${selectedResult.pngBase64}`}
              format={format}
              onExport={handleSave}
            />
          </section>
        )}

        {/* Post-save: schedule link */}
        {savedId && (
          <section className="flex flex-col gap-2">
            <p className="text-center text-sm font-medium" style={{ color: "var(--green)" }}>
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
        )}
      </div>
    </div>
  );
}
