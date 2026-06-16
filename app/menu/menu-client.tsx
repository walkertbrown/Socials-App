"use client";

// Full UI flow for the Menu Maker:
//   Step 1 (idle)   — PDF file picker
//   Step 2 (preview) — interactive cut-line editor + Generate button
//   Step 3 (results) — download links for all outputs

import { useState, useRef } from "react";
import { CutLineEditor } from "./cut-line-editor";
import { OutputCard } from "./output-card";

type Step = "idle" | "loading-preview" | "preview" | "generating" | "results";

interface Results {
  fullPage: string;
  sections: string[];
}

export function MenuClient() {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [cuts, setCuts] = useState<number[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const fileRef = useRef<File | null>(null);

  function reset() {
    setStep("idle");
    setError(null);
    setPreviewSrc(null);
    setCuts([]);
    setResults(null);
    fileRef.current = null;
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("pdf") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    fileRef.current = file;
    setStep("loading-preview");
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/menu/preview", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Preview failed");
      setPreviewSrc(`data:image/png;base64,${json.preview}`);
      setCuts([]);
      setStep("preview");
    } catch (err) {
      setError((err as Error).message);
      setStep("idle");
    }
  }

  async function handleGenerate() {
    if (!fileRef.current || cuts.length === 0) return;

    setStep("generating");
    setError(null);

    const fd = new FormData();
    fd.append("file", fileRef.current);
    fd.append("cuts", JSON.stringify(cuts));

    try {
      const res = await fetch("/api/menu/process", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generate failed");
      setResults({ fullPage: json.fullPage, sections: json.sections });
      setStep("results");
    } catch (err) {
      setError((err as Error).message);
      setStep("preview");
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Menu Maker</h1>
      <p className="text-sm text-zinc-500">PDF menu to full-page PNG + Instagram square sections.</p>

      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1 — idle */}
      {(step === "idle" || step === "loading-preview") && (
        <form onSubmit={handleUpload} className="space-y-3">
          <input
            type="file"
            name="pdf"
            accept="application/pdf"
            required
            className="block w-full text-sm text-zinc-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-zinc-100 file:text-sm file:font-medium hover:file:bg-zinc-200"
          />
          <button
            type="submit"
            disabled={step === "loading-preview"}
            className="px-4 py-2 rounded bg-[#0f3d3e] text-white text-sm font-medium hover:bg-[#0f3d3e]/80 disabled:opacity-50 transition-colors"
          >
            {step === "loading-preview" ? "Rendering preview..." : "Upload & Preview"}
          </button>
        </form>
      )}

      {/* Step 2 — preview */}
      {(step === "preview" || step === "generating") && previewSrc && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">Click to add cut lines. Drag to adjust.</p>
          <CutLineEditor previewSrc={previewSrc} onChange={setCuts} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={cuts.length === 0 || step === "generating"}
              className="px-4 py-2 rounded bg-[#0f3d3e] text-white text-sm font-medium hover:bg-[#0f3d3e]/80 disabled:opacity-50 transition-colors"
            >
              {step === "generating" ? "Generating..." : "Generate"}
            </button>
            <button type="button" onClick={reset} className="text-sm text-zinc-400 hover:text-zinc-600 underline">
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — results */}
      {step === "results" && results && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <OutputCard base64Png={results.fullPage} filename="menu-full.png" label="Full page" />
            {results.sections.map((s, i) => (
              <OutputCard
                key={i}
                base64Png={s}
                filename={`menu-section-${i + 1}.png`}
                label={`Section ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded bg-zinc-100 text-zinc-700 text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
