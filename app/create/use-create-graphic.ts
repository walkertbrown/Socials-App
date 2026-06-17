"use client";

// useCreateGraphic — state machine + async actions for the Create Graphic screen.
//
// Encapsulates all useState calls and fetch logic so create-client.tsx stays
// under the ~300-line ceiling and is pure layout/render.
//
// Phase machine:
//   "prompt"    → user is typing
//   "questions" → clarifying questions loaded; user is answering
//   "ready"     → answers submitted (or none to ask); Generate button shows
//   "results"   → images returned from both models

import { useState, useEffect } from "react";
import type { Question, Answer } from "./clarifying-questions";
import { loadDraft, saveDraft, clearDraft } from "./create-draft";

export interface GenerateResult {
  model: string;
  ok: boolean;
  pngBase64?: string;
  error?: string;
}

// Serialize answers to a stable string key for cache comparison.
function answersKey(answers: Answer[]): string {
  return JSON.stringify(
    [...answers].sort((a, b) => a.question.localeCompare(b.question))
  );
}

export function useCreateGraphic() {
  const [prompt, setPromptRaw] = useState("");
  const [format, setFormat] = useState<"feed" | "story">("feed");

  const [phase, setPhase] = useState<
    "prompt" | "questions" | "ready" | "results"
  >("prompt");

  // Clarifying-questions state.
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  // Generation state.
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [results, setResults] = useState<GenerateResult[] | null>(null);

  // Enhanced-prompt cache — keyed by (prompt text + answers).
  const [cachedEnhancedPrompt, setCachedEnhancedPrompt] = useState<string>("");
  const [cachedForPrompt, setCachedForPrompt] = useState<string>("");
  const [cachedForAnswers, setCachedForAnswers] = useState<string>("");

  // Post-generation selection and save state.
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Draft persistence (survive refresh / accidental tab close) ──────────────
  // Restore on mount, save on every change. `hydrated` is state (not a ref) so
  // the save effect only runs AFTER the restore, never clobbering saved data
  // with empty defaults. See create-draft.ts for what's persisted (and why the
  // heavy result images are not).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setPromptRaw(d.prompt);
      setFormat(d.format);
      setQuestions(d.questions);
      setAnswers(d.answers);
      setCachedEnhancedPrompt(d.cachedEnhancedPrompt);
      setCachedForPrompt(d.cachedForPrompt);
      setCachedForAnswers(d.cachedForAnswers);
      setPhase(d.phase);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!prompt.trim()) {
      clearDraft(); // nothing worth keeping once the prompt is empty
      return;
    }
    saveDraft({
      prompt,
      format,
      phase: phase === "results" ? "ready" : phase,
      questions,
      answers,
      cachedEnhancedPrompt,
      cachedForPrompt,
      cachedForAnswers,
    });
  }, [
    hydrated,
    prompt,
    format,
    phase,
    questions,
    answers,
    cachedEnhancedPrompt,
    cachedForPrompt,
    cachedForAnswers,
  ]);

  // ── Prompt change ─────────────────────────────────────────────────────────
  // Editing the prompt text resets the questions phase.
  function setPrompt(value: string) {
    setPromptRaw(value);
    if (phase !== "prompt") {
      setPhase("prompt");
      setQuestions([]);
      setAnswers([]);
      setQuestionsError(null);
    }
  }

  // ── Fetch clarifying questions ─────────────────────────────────────────────
  async function fetchQuestions() {
    if (!prompt.trim()) return;
    setLoadingQuestions(true);
    setQuestionsError(null);
    setQuestions([]);
    setAnswers([]);

    try {
      const res = await fetch("/api/graphics/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), format }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to fetch questions");
      const qs = d.questions ?? [];
      setQuestions(qs);
      // If Sonnet had nothing to ask, skip straight to the Generate step.
      setPhase(qs.length > 0 ? "questions" : "ready");
    } catch (e) {
      setQuestionsError((e as Error).message);
      // A question hiccup must never block her — go straight to Generate.
      setPhase("ready");
    }
    setLoadingQuestions(false);
  }

  // ── Submit answers ─────────────────────────────────────────────────────────
  // Collapse the questions and reveal the Generate button. Answers can be empty
  // (skippable) — submitting just advances the phase.
  function submitAnswers() {
    setPhase("ready");
  }

  // Go back from "ready" to edit the answers (only if there were questions).
  function editAnswers() {
    if (questions.length > 0) setPhase("questions");
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  async function generate() {
    if (!prompt.trim()) return setGenerateError("Enter a prompt first.");
    setGenerating(true);
    setGenerateError(null);
    setResults(null);
    setSelectedModel(null);
    setSavedId(null);
    setSaveError(null);

    const currentAnswersKey = answersKey(answers);
    const cacheHit =
      prompt.trim() === cachedForPrompt &&
      currentAnswersKey === cachedForAnswers &&
      !!cachedEnhancedPrompt;

    try {
      const res = await fetch("/api/graphics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          format,
          enhancedPrompt: cacheHit ? cachedEnhancedPrompt : undefined,
          answers: answers.length > 0 ? answers : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Generation failed");
      setResults(d.results);
      if (d.enhancedPrompt) {
        setCachedEnhancedPrompt(d.enhancedPrompt);
        setCachedForPrompt(prompt.trim());
        setCachedForAnswers(currentAnswersKey);
      }
      setPhase("results");
    } catch (e) {
      setGenerateError((e as Error).message);
    }
    setGenerating(false);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
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
          prompt: prompt.trim(),
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

  const selectedResult =
    results?.find((r) => r.model === selectedModel && r.ok) ?? null;

  return {
    // Prompt + format
    prompt,
    setPrompt,
    format,
    setFormat,
    // Phase
    phase,
    // Questions
    questions,
    answers,
    setAnswers,
    loadingQuestions,
    questionsError,
    fetchQuestions,
    submitAnswers,
    editAnswers,
    // Generation
    generating,
    generateError,
    results,
    generate,
    // Selection + save
    selectedModel,
    setSelectedModel,
    selectedResult,
    saving,
    savedId,
    saveError,
    handleSave,
  };
}
