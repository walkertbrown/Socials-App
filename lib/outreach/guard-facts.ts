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
  // Server or staff names following "your server" / "ask for" — case-insensitive
  // (an LLM writes "Ask for Michelle" / "Your server Tracy"); skip common
  // non-name continuations ("ask for the menu", "ask for details").
  /\b(?:your\s+server|ask\s+for)\s+(?!the\b|a\b|an\b|our\b|your\b|us\b|it\b|me\b|them\b|any\b|more\b|info\b|details?\b|recommendations?\b)[a-z][a-z']+/i,
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
  const allowed = buildAllowedWords(facts);

  for (const pattern of INVENTED_SPECIFICS_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    // If every meaningful word in the matched span is actually on file (in the
    // guest's notes/name), it's a real detail, not a hallucination — don't flag.
    // (Dollar amounts produce no such words, so "$250" is always flagged.)
    const words = m[0].toLowerCase().match(/[a-z]{4,}/g) ?? [];
    if (words.length > 0 && words.every((w) => allowed.has(w))) continue;
    return { passed: false, reason: `Likely hallucination: "${m[0].trim()}"` };
  }

  return { passed: true };
}
