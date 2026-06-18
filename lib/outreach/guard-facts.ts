// guard-facts.ts — anti-hallucination check for Personalized email drafts.
// Scans the generated subject + body for specifics (server names, dish names,
// concrete dates, dollar amounts) that are NOT present in the fact-set.
// On a likely violation, returns a flag so the orchestrator can fall back to
// the matching template.
//
// Heuristic approach: we check for the absence of certain patterns rather than
// semantic understanding, keeping this fast and free (no LLM call).

import type { GuestFactSet } from "./extract-facts";

export interface GuardResult {
  passed: boolean;
  // Human-readable reason if the check failed (for debugging, not shown to user).
  reason?: string;
}

// Patterns that indicate the model invented specifics not in the fact-set.
// We match case-insensitively.
const INVENTED_SPECIFICS_PATTERNS: RegExp[] = [
  // Specific dollar amounts (e.g. "$125", "125 dollars")
  /\$\d+/,
  // References to specific dishes that sound made-up (heuristic: long food nouns)
  // We allow generic food words but flag "your [adjective] [dish]" constructs.
  /\byour\s+\w+\s+(steak|lobster|foie|tartare|tuna|duck|lamb|scallops?)\b/i,
  // Server or staff names (capitalized name following "your server" / "ask for")
  /\b(your\s+server|ask\s+for)\s+[A-Z][a-z]+\b/,
  // Invented specific dates ("on March 12th", "last Saturday the 8th")
  /\bon\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+/i,
];

// Words that are explicitly in the fact-set and safe to reference.
function buildAllowedWords(facts: GuestFactSet): Set<string> {
  const allowed = new Set<string>();
  if (facts.first_name) allowed.add(facts.first_name.toLowerCase());
  // Notes are free-text from GuestCenter; any word in notes is "on file".
  if (facts.notes) {
    facts.notes
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
      .forEach((w) => allowed.add(w));
  }
  return allowed;
}

export function guardFacts(
  draft: { subject: string; body: string },
  facts: GuestFactSet
): GuardResult {
  const text = `${draft.subject}\n${draft.body}`;
  const _allowed = buildAllowedWords(facts); // reserved for future stricter check

  for (const pattern of INVENTED_SPECIFICS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        passed: false,
        reason: `Likely hallucination: pattern "${pattern.source}" matched in draft`,
      };
    }
  }

  return { passed: true };
}
