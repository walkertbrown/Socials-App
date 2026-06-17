"use client";

// Create Graphic screen — sub-screen of Studio (back arrow, bottom tab stays).
// Renders the prompt, clarifying-questions, results, and overlay/save sections.
// All state and async logic live in useCreateGraphic.
//
// Flow:
//   1. "prompt" phase  → user types, presses Enter or "Continue" → fetchQuestions
//   2. "questions" phase → answers optional questions → "Submit answers"
//   3. "ready" phase   → "Generate" → call image models
//   4. "results" phase → two images; pick one → overlay → save

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
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

export function CreateClient({ userEmail: _userEmail = "" }: CreateClientProps) {
  const router = useRouter();
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
    submitAnswers,
    editAnswers,
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

  // The primary CTA label + action depend on the current phase.
  //   prompt    → "Continue"        → fetch questions
  //   questions → "Submit answers"  → collapse questions, reveal Generate
  //   ready     → "Generate"        → call both image models
  //   results   → "Regenerate"      → call both image models again
  function primaryLabel() {
    if (phase === "prompt") {
      return loadingQuestions ? "Loading questions…" : "Continue";
    }
    if (phase === "questions") return "Submit answers";
    return generating ? "Generating…" : results ? "Regenerate" : "Generate";
  }

  function handlePrimaryClick() {
    if (phase === "prompt") fetchQuestions();
    else if (phase === "questions") submitAnswers();
    else generate();
  }

  // "Submit answers" is always allowed (answers are optional); Continue/Generate
  // are blocked while a request is in flight or the prompt is empty.
  const primaryDisabled =
    phase === "questions"
      ? false
      : loadingQuestions || generating || !prompt.trim();

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-4">

        {/* Back arrow — sub-screen of Studio */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 self-start text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text-dim)", background: "none", border: "none" }}
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          Studio
        </button>

        <div>
          <p className="eyebrow mb-1">STUDIO</p>
          <h1 className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)", fontWeight: 500, color: "var(--text-primary)" }}>
            Create graphic
          </h1>
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
                      ? { background: "var(--gold)", color: "var(--on-accent)" }
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
              className="btn-teal ml-auto rounded-md px-5 py-2 text-sm font-medium"
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

        {/* ── Clarifying questions (only while answering) ── */}
        {phase === "questions" && questions.length > 0 && (
          <ClarifyingQuestions
            questions={questions}
            answers={answers}
            onChange={setAnswers}
          />
        )}

        {/* ── Non-blocking note if questions couldn't load ── */}
        {questionsError && phase !== "results" && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Couldn’t load questions ({questionsError}) — you can still hit Generate.
          </p>
        )}

        {/* ── Once answers are submitted, a compact summary + edit link ── */}
        {phase === "ready" && answers.length > 0 && (
          <button
            onClick={editAnswers}
            className="self-start text-sm underline"
            style={{ color: "var(--text-dim)" }}
          >
            ✓ {answers.length} answer{answers.length > 1 ? "s" : ""} set · Edit
          </button>
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
    </AppShell>
  );
}
