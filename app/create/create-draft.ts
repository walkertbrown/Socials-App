// Draft persistence for the Create Graphic screen.
//
// Keeps the LIGHTWEIGHT state (prompt, format, phase, questions, answers, and
// the prompt cache) in localStorage so a refresh or accidental tab close never
// wipes her work. The heavy results (base64 PNGs) are deliberately excluded —
// too large for localStorage, and they cost money to hold — so a restored
// "results" phase comes back as "ready", one tap from regenerating.

import type { Question, Answer } from "./clarifying-questions";

const DRAFT_KEY = "create-graphic-draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // ignore drafts older than 24h

export interface CreateDraft {
  prompt: string;
  format: "feed" | "story";
  phase: "prompt" | "questions" | "ready";
  questions: Question[];
  answers: Answer[];
  cachedEnhancedPrompt: string;
  cachedForPrompt: string;
  cachedForAnswers: string;
}

export function loadDraft(): CreateDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.savedAt !== "number") return null;
    if (Date.now() - d.savedAt >= DRAFT_TTL_MS) return null;

    // A saved "results" phase restores to "ready" since images aren't kept.
    const phase: CreateDraft["phase"] =
      d.phase === "questions"
        ? "questions"
        : d.phase === "ready" || d.phase === "results"
          ? "ready"
          : "prompt";

    return {
      prompt: typeof d.prompt === "string" ? d.prompt : "",
      format: d.format === "story" ? "story" : "feed",
      phase,
      questions: Array.isArray(d.questions) ? d.questions : [],
      answers: Array.isArray(d.answers) ? d.answers : [],
      cachedEnhancedPrompt:
        typeof d.cachedEnhancedPrompt === "string" ? d.cachedEnhancedPrompt : "",
      cachedForPrompt:
        typeof d.cachedForPrompt === "string" ? d.cachedForPrompt : "",
      cachedForAnswers:
        typeof d.cachedForAnswers === "string" ? d.cachedForAnswers : "",
    };
  } catch {
    return null; // corrupt or unavailable storage — start fresh
  }
}

export function saveDraft(draft: CreateDraft): void {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ savedAt: Date.now(), ...draft })
    );
  } catch {
    // quota or unavailable storage — non-fatal
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // non-fatal
  }
}
