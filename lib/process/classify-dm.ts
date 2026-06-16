import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AutoReplyRule } from "@/lib/db/auto-reply-rules";

const MODEL = "claude-haiku-4-5";

// Given an inbound DM body and the active auto-reply rules, return the id of
// the matching rule — or null if no rule clearly applies.
//
// Conservative by design: null is the safe default. Only returns a rule id when
// the match is explicit and unambiguous. Complaints, crises, or anything where
// the intent isn't crystal clear → null → manual inbox.
export async function classifyDm(
  dmBody: string,
  rules: AutoReplyRule[]
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  if (rules.length === 0) return null;

  const client = new Anthropic({ apiKey });

  const ruleList = rules
    .map((r) => `ID: ${r.id}\nTrigger: ${r.trigger_pattern}`)
    .join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 100,
    system:
      "You classify incoming Instagram/Facebook DMs for a restaurant to decide if an auto-reply rule applies. " +
      "You MUST be conservative — return null unless the match is explicit and unambiguous. " +
      "ALWAYS return null for: complaints, negative feedback, crises, urgent or distressed messages, " +
      "anything where auto-reply could make things worse, or anything unclear.\n\n" +
      "Rules (each has an ID and a trigger pattern describing what it matches):\n\n" +
      ruleList +
      "\n\nRespond with ONLY a JSON object: {\"rule_id\": \"<id>\"} or {\"rule_id\": null}. No prose.",
    messages: [
      {
        role: "user",
        content: `Incoming DM:\n${dmBody}\n\nWhich rule, if any, clearly applies? Return JSON only.`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");

  return parseRuleId(text, rules);
}

function parseRuleId(text: string, rules: AutoReplyRule[]): string | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const obj = JSON.parse(text.slice(start, end + 1));
    const ruleId = obj.rule_id;
    if (!ruleId || typeof ruleId !== "string") return null;
    // Verify the returned id actually exists in our active rules list (guard against hallucination).
    return rules.some((r) => r.id === ruleId) ? ruleId : null;
  } catch {
    return null;
  }
}
