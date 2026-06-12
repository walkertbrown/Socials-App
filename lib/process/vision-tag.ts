import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CONTENT_TAGS, isContentTag, type ContentTag } from "@/lib/tags";

const MODEL = "claude-haiku-4-5";

// One cheap vision call per photo: classify the thumbnail into a single label.
export async function tagPhoto(thumbnail: Buffer): Promise<ContentTag> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16,
    system:
      "You label restaurant social-media photos. Reply with exactly one word " +
      `from this list and nothing else: ${CONTENT_TAGS.join(", ")}.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: thumbnail.toString("base64"),
            },
          },
          { type: "text", text: "Which single label best fits this photo?" },
        ],
      },
    ],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join(" ")
    .toLowerCase();

  const word = text.split(/[^a-z]+/).find((w) => isContentTag(w));
  return (word as ContentTag) ?? "other";
}
