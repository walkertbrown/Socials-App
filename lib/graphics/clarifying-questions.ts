import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Use Sonnet for the clarifying-questions step — same model as enhance-prompt.
const MODEL = "claude-sonnet-4-6";

export interface Question {
  id: string;
  question: string;
  options: [string, string, string]; // exactly 3
}

interface ClarifyingQuestionsInput {
  prompt: string;
  format: "feed" | "story";
}

// Calls Claude Sonnet to generate 1–3 short clarifying questions that would
// sharpen the image brief.  Returns only validated questions; throws on
// malformed JSON or a bad shape so the route can surface a clean error.
export async function getClarifyingQuestions(
  input: ClarifyingQuestionsInput
): Promise<Question[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");

  const client = new Anthropic({ apiKey });

  const formatHint =
    input.format === "story"
      ? "The graphic will be an Instagram/Facebook Story (9:16 portrait)."
      : "The graphic will be a social media Feed post (1:1 square).";

  const systemPrompt = `You are the design assistant for The Pelican Club, an upscale French-Quarter New Orleans restaurant.

Your job: given a short creative brief, ask 1–3 short clarifying questions that would most sharpen an AI-generated graphic.

Rules:
1. Only ask questions that genuinely change how the image should look.  If the brief is already specific, ask 1 question or even none (return an empty array).
2. Each question must have exactly 3 distinct, concrete preset answer options.
3. Questions must be short and plain — under 12 words.
4. Options must be short — 3–5 words each.
5. Return ONLY valid JSON in this exact shape, no extra keys, no explanation:
{"questions":[{"id":"q1","question":"...","options":["...","...","..."]}]}`;

  const userMsg = `Brief: ${input.prompt}
${formatHint}

Return your clarifying questions as JSON.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  // Strip markdown code fences if the model wraps the JSON.
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`Clarifying-questions response was not valid JSON: ${raw.slice(0, 200)}`);
  }

  return validateQuestions(parsed);
}

// Validates the parsed JSON and returns a clean Question[].
// Throws a descriptive error on any shape violation.
function validateQuestions(raw: unknown): Question[] {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !Array.isArray((raw as Record<string, unknown>).questions)
  ) {
    throw new Error('Clarifying-questions response missing "questions" array');
  }

  const items = (raw as { questions: unknown[] }).questions;

  // Clamp to 3 max (plan specifies 1–3).
  const clamped = items.slice(0, 3);

  const questions: Question[] = [];

  for (const item of clamped) {
    if (typeof item !== "object" || item === null) {
      throw new Error("Each question must be an object");
    }
    const q = item as Record<string, unknown>;

    if (typeof q.id !== "string" || !q.id.trim()) {
      throw new Error("Each question must have a non-empty string id");
    }
    if (typeof q.question !== "string" || !q.question.trim()) {
      throw new Error("Each question must have a non-empty string question");
    }
    if (
      !Array.isArray(q.options) ||
      q.options.length !== 3 ||
      q.options.some((o) => typeof o !== "string" || !(o as string).trim())
    ) {
      throw new Error(
        `Question "${q.id}" must have exactly 3 non-empty string options`
      );
    }

    questions.push({
      id: q.id as string,
      question: q.question as string,
      options: q.options as [string, string, string],
    });
  }

  // An empty array is valid — the model may decide no questions are needed.
  return questions;
}
