import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";

// Second pass: rewrite the caption so it reads like a real (slightly witty)
// person wrote it, stripping the patterns that make copy feel AI-generated.
export async function editCaption(caption: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return caption;
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 220,
    system:
      "You edit a New Orleans restaurant's social captions. Rewrite so it reads like a real, slightly witty person wrote it, never like AI. " +
      "Cut the AI tells: over-used em-dashes, 'elevate', 'nestled', 'whether you're', 'there's nothing quite like', 'a testament to', " +
      "'in the heart of', hollow tricolons, and generic 'magic / memories are made / unforgettable' filler. " +
      "Keep the real specifics, the reservation call-to-action, any reservation link or web address exactly as written, and the hashtags. Make it tighter, plainer, and more human. " +
      "Return ONLY the edited caption.",
    messages: [{ role: "user", content: caption }],
  });

  return message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join(" ")
    .trim();
}
