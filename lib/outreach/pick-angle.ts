// pick-angle.ts — chooses a writing angle + tone from the guest fact-set.
// No LLM here — deterministic priority logic.
//
// Priority order:
//   1. Service recovery (≤3★ review, if review data is present in Phase 2+)
//   2. Occasion (birthday / anniversary / first_visit_anniversary)
//   3. Win-back (lapsed 1+ year)
//   4. Recent thank-you (within 90 days)
//   5. General re-engagement fallback

import type { GuestFactSet } from "./extract-facts";

export type Angle =
  | "birthday"
  | "anniversary"
  | "visit_anniversary"
  | "service_recovery"
  | "win_back"
  | "thank_you"
  | "re_engage";

export interface AngleResult {
  angle: Angle;
  // Plain description forwarded to the template or LLM so the email opener
  // can match the chosen tone without us re-encoding all the logic there.
  tone_note: string;
}

export function pickAngle(facts: GuestFactSet): AngleResult {
  // 1. Occasion takes precedence (if an occasion was flagged at call time).
  if (facts.occasion === "birthday") {
    return {
      angle: "birthday",
      tone_note: "warm birthday greeting + invite back to celebrate at the venue",
    };
  }
  if (facts.occasion === "anniversary") {
    return {
      angle: "anniversary",
      tone_note: "warm anniversary congratulations + invite back to celebrate",
    };
  }
  if (facts.occasion === "first_visit_anniversary") {
    return {
      angle: "visit_anniversary",
      tone_note: "nostalgic nod to their first visit + invite back",
    };
  }

  // 2. Service recovery — only triggered when a matched low-star review is
  //    present (Phase 2 integration). In Phase 1 this branch never fires, but
  //    the hook is wired so guard-facts.ts can route here if review data arrives.
  // (no facts field for this yet; reserved for Phase 2)

  // 3. Lapsed win-back.
  if (
    facts.recency === "lapsed_1_2_years" ||
    facts.recency === "lapsed_2_plus_years"
  ) {
    return {
      angle: "win_back",
      tone_note: "acknowledge the gap warmly, invite them back, no pressure",
    };
  }

  // 4. Recent thank-you.
  if (
    facts.recency === "within_30_days" ||
    facts.recency === "within_90_days"
  ) {
    return {
      angle: "thank_you",
      tone_note: "thank them for their recent visit, brief warm mention of it",
    };
  }

  // 5. General re-engagement for everyone else (within_6_months,
  //    within_1_year, never_tracked).
  return {
    angle: "re_engage",
    tone_note: "friendly check-in, remind them what makes the venue special",
  };
}
