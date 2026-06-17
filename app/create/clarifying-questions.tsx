"use client";

// ClarifyingQuestions — renders 1–3 questions from Claude Sonnet, each with
// 3 preset option buttons + a "type your own" text field (single-select).
// The parent collects answers; unanswered questions are simply omitted.

import { useState } from "react";

export interface Question {
  id: string;
  question: string;
  options: [string, string, string];
}

export interface Answer {
  question: string;
  answer: string;
}

interface ClarifyingQuestionsProps {
  questions: Question[];
  // answers keyed by question id for quick lookup; emits full Answer[] upward.
  answers: Answer[];
  onChange: (updated: Answer[]) => void;
}

// Merge a new answer (or overwrite an existing one) into the answers array.
// The array is keyed by question text so the parent can serialize it for the API.
function setAnswer(
  prev: Answer[],
  question: Question,
  value: string
): Answer[] {
  // Remove any existing answer for this question, then prepend the new one if
  // the value is non-empty.
  const filtered = prev.filter((a) => a.question !== question.question);
  if (!value.trim()) return filtered;
  return [...filtered, { question: question.question, answer: value.trim() }];
}

export function ClarifyingQuestions({
  questions,
  answers,
  onChange,
}: ClarifyingQuestionsProps) {
  // Per-question custom text-field value; not lifted up so it stays local.
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // Returns the current chosen answer string for a question (preset or custom).
  function currentAnswer(q: Question): string {
    return answers.find((a) => a.question === q.question)?.answer ?? "";
  }

  function handleOptionClick(q: Question, option: string) {
    // Clear the custom text for this question when a preset is selected.
    setCustomValues((prev) => ({ ...prev, [q.id]: "" }));
    onChange(setAnswer(answers, q, option));
  }

  function handleCustomChange(q: Question, value: string) {
    setCustomValues((prev) => ({ ...prev, [q.id]: value }));
    // Custom text takes priority: if non-empty it becomes the selected answer.
    onChange(setAnswer(answers, q, value));
  }

  if (questions.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      <p
        className="text-sm font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        A few quick questions to sharpen the image (all optional):
      </p>

      {questions.map((q) => {
        const chosen = currentAnswer(q);
        const customVal = customValues[q.id] ?? "";
        // The custom field is "active" when it has a value (and therefore chosen).
        const customActive = customVal.trim().length > 0;

        return (
          <div key={q.id} className="flex flex-col gap-2">
            <label
              className="text-sm"
              style={{ color: "var(--text-primary)", fontWeight: 500 }}
            >
              {q.question}
            </label>

            {/* Preset option buttons */}
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const isSelected = !customActive && chosen === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleOptionClick(q, opt)}
                    className="rounded-full px-4 py-1.5 text-sm transition-colors"
                    style={
                      isSelected
                        ? {
                            background: "var(--gold)",
                            color: "var(--bg)",
                          }
                        : {
                            background: "var(--surface-hi)",
                            color: "var(--text-secondary)",
                          }
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* "Type your own" text field */}
            <input
              type="text"
              value={customVal}
              onChange={(e) => handleCustomChange(q, e.target.value)}
              placeholder="Or type your own…"
              className="w-full rounded-md p-2 text-sm"
              style={{
                border: customActive
                  ? "1px solid var(--gold)"
                  : "1px solid var(--border-hi)",
                background: "var(--surface-hi)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        );
      })}
    </section>
  );
}
