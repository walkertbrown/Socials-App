"use client";

// Create Graphic screen — renders the prompt, clarifying-questions, results,
// and overlay/save sections.  All state and async logic live in useCreateGraphic.
//
// Flow:
//   1. "prompt" phase  → user types, presses Enter or "Continue" → fetchQuestions
//   2. "questions" phase → answers optional questions → "Generate"
//   3. "results" phase  → two images; pick one → overlay → save

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ClarifyingQuestions } from "./clarifying-questions";
import { ResultsGallery } from "./results-gallery";
import { OverlaySaveSection } from "./overlay-save-section";
import { useCreateGraphic } from "./use-create-graphic";

interface CreateClientProps {
  userEmail?: string;
}

const MODEL_LABEL: Record<string, string> = {
  "nano-banana-2": "Nano Banana 2",
  "gpt-image-2": "GPT Image 2",
};

export function CreateClient({ userEmail = "" }: CreateClientProps) {
  const {
    prompt,
    setPrompt,
    format,
    setFormat,
    phase,
    questions,
    answers,
    setAnswers,
    loadingQuestions,
    questionsError,
    fetchQuestions,
    generating,
    generateError,
    results,
    generate,
    selectedModel,
    setSelectedModel,
    selectedResult,
    saving,
    savedId,
    saveError,
    handleSave,
  } = useCreateGraphic();

  // The primary CTA label depends on the current phase.
  function primaryLabel() {
    if (phase === "prompt") {
      return loadingQuestions ? "Loading questions…" : "Continue";
    }
    return generating ? "Generating…" : results ? "Regenerate" : "Generate";
  }

  function handlePrimaryClick() {
    if (phase === "prompt") fetchQuestions();
    else generate();
  }

  const primaryDisabled = loadingQuestions || generating || !prompt.trim();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={userEmail} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4">

        {/* ── Header ── */}
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

        {/* ── Prompt + format + primary CTA ── */}
        <section className="flex flex-col gap-3">
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              What would you like to create?
            </label>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && phase === "prompt" && !primaryDisabled) {
                  fetchQuestions();
                }
              }}
              placeholder="e.g. happy pride month, weekly happy hour reminder…"
              className="w-full rounded-md p-2 text-sm"
              style={{ border: "1px solid var(--border-hi)", background: "var(--surface-hi)", color: "var(--text-primary)" }}
            />
          </div>

          <div className="flex items-center gap-3">
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
              onClick={handlePrimaryClick}
              disabled={primaryDisabled}
              className="ml-auto rounded-md px-5 py-2 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--gold)", color: "var(--bg)" }}
            >
              {primaryLabel()}
            </button>
          </div>

          {loadingQuestions && (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Thinking up a few questions…
            </p>
          )}
          {generating && (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Calling both image models in parallel — this can take up to 60 s…
            </p>
          )}
          {generateError && (
            <p className="text-sm" style={{ color: "var(--red)" }}>{generateError}</p>
          )}
        </section>

        {/* ── Clarifying questions ── */}
        {phase !== "prompt" && (
          <div className="flex flex-col gap-3">
            {questionsError && (
              <div className="flex flex-col gap-2">
                <p className="text-sm" style={{ color: "var(--red)" }}>
                  Could not load questions: {questionsError}
                </p>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="self-start rounded-md px-4 py-1.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--surface-hi)", color: "var(--text-secondary)", border: "1px solid var(--border-hi)" }}
                >
                  {generating ? "Generating…" : "Generate anyway"}
                </button>
              </div>
            )}
            {!questionsError && questions.length > 0 && (
              <ClarifyingQuestions
                questions={questions}
                answers={answers}
                onChange={setAnswers}
              />
            )}
          </div>
        )}

        {/* ── Side-by-side results ── */}
        {results && !selectedModel && (
          <ResultsGallery
            results={results}
            modelLabel={MODEL_LABEL}
            onSelect={setSelectedModel}
          />
        )}

        {/* ── Text overlay + save + post-save schedule link ── */}
        {selectedResult && selectedResult.pngBase64 && (
          <OverlaySaveSection
            pngBase64={selectedResult.pngBase64}
            format={format}
            modelName={MODEL_LABEL[selectedResult.model] ?? selectedResult.model}
            saving={saving}
            saveError={saveError}
            savedId={savedId}
            onPickDifferent={() => setSelectedModel(null)}
            onSave={handleSave}
          />
        )}

      </div>
    </div>
  );
}
