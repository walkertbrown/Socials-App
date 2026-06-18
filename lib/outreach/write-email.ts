import "server-only";
// write-email.ts — ONE claude-haiku-4-5 call that writes subject + body for a
// Personalized guest. Humanizing anti-AI-tell instructions are folded into the
// same system prompt — no separate edit pass.
//
// Hard rules (cost-watchdog):
//   - Model is hard-coded to claude-haiku-4-5 (never Sonnet/Opus).
//   - max_tokens is kept tight (600 for subject + body combined is generous).
//   - Only the provided fact-set may be used; the model is instructed not to
//     invent specifics not present in that set.

import Anthropic from "@anthropic-ai/sdk";
import type { GuestFactSet } from "./extract-facts";
import type { AngleResult } from "./pick-angle";

const MODEL = "claude-haiku-4-5";

export interface WrittenEmail {
  subject: string;
  body: string;
}

// Converts the fact-set to a plain-text briefing the model can use.
// Spend dollar amounts are NOT included — only the tier label.
function factsToPrompt(facts: GuestFactSet, angle: AngleResult): string {
  const lines: string[] = [
    `Guest first name: ${facts.first_name ?? "(unknown)"}`,
    `Angle: ${angle.angle}`,
    `Tone guidance: ${angle.tone_note}`,
    `Recency: ${facts.recency.replace(/_/g, " ")}`,
    `Visit count tier: ${facts.visit_count_tier}${facts.visit_count !== null ? ` (${facts.visit_count} visits on record)` : ""}`,
    `Tenure: ${facts.tenure}${facts.years_since_first !== null ? ` (~${Math.floor(facts.years_since_first)} years)` : ""}`,
    `Spend tier: ${facts.spend_tier}`,
  ];
  if (facts.occasion) lines.push(`Occasion: ${facts.occasion.replace(/_/g, " ")}`);
  if (facts.notes) lines.push(`Notes on file: ${facts.notes}`);
  return lines.join("\n");
}

export async function writeEmail(
  facts: GuestFactSet,
  angle: AngleResult
): Promise<WrittenEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You write short, personalized emails for The Pelican Club, an upscale New Orleans French Quarter restaurant open since 1990.
Write ONE email (a subject line and a short body) using ONLY the facts provided. Never invent dishes, servers, dates, prices, or any detail that isn't in the facts.

Voice (write the way the owner actually writes to guests):
- Warm, genuine, and a little playful. A real person, never corporate, never a marketing template.
- Open with sincere warmth; use the guest's first name naturally when you have it.
- Anchor the whole email on the ONE concrete thing you actually know about this guest (what they loved, their occasion, or how long it's been) and build around it. Specific, never generic.
- A warm exclamation point is fine when it's genuine; don't overdo it.
- Short: 2 to 4 sentences. Use "we" for the restaurant.
- Close with a warm, low-pressure invitation to come back.
- Vary your opening and structure every time. Never settle into a repeatable formula.

Service-recovery emails (an unhappy guest): thank them sincerely, acknowledge what genuinely went well if anything did, then give a plain, honest apology for the specific thing that fell short. No excuses, no defensiveness, no spin. Warmly invite them to let you make it right on another visit.

Hard style rules:
- NO em dashes and NO en dashes, ever. For an aside, use a comma, a period, or parentheses instead. (Em dashes read as AI-written.)
- Cut AI tells: no "elevate your experience", "nestled in the heart of", "there's nothing quite like", "a testament to", hollow tricolons, or "magic / memories / unforgettable" filler.
- Contractions are good. Short sentences are good.
- End with a clear reservation nudge: "Reserve on OpenTable."
- Sign off: "Warmly, The Pelican Club"

Format your response as exactly two sections, each label on its own line, with NO extra text:
SUBJECT: <the subject line>
BODY:
<the full email body>`;

  const userMessage = `Write a personalized email for this guest using only the facts below:\n\n${factsToPrompt(facts, angle)}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  return parseResponse(raw);
}

// Parse the model's response into subject + body.
// Falls back to safe defaults if parsing fails rather than throwing.
function parseResponse(raw: string): WrittenEmail {
  const subjectMatch = raw.match(/^SUBJECT:\s*(.+)$/m);
  const bodyMatch = raw.match(/^BODY:\s*\n([\s\S]+)$/m);

  const subject = subjectMatch?.[1]?.trim() ?? "A note from The Pelican Club";
  const body = bodyMatch?.[1]?.trim() ?? raw;

  return { subject, body };
}
