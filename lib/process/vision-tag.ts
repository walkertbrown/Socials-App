import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { SORTABLE, isCategoryKey, type CategoryKey } from "@/lib/categories";

const MODEL = "claude-haiku-4-5";

// One vision call per photo: sort it into the venue's category, or "unsorted"
// if nothing clearly fits.
export async function categorizePhoto(thumbnail: Buffer): Promise<CategoryKey> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey });

  const keys = SORTABLE.map((c) => c.key).join(", ");
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16,
    system:
      "You sort a restaurant's social-media photos into one category. " +
      `Reply with exactly one of these keys and nothing else: ${keys}. ` +
      "If none clearly fits, reply: unsorted.\n" +
      "food_drink = dishes, drinks, plating, close-ups of food or cocktails.\n" +
      "events = a party, show, live music, special event, a busy event crowd.\n" +
      "behind_scenes = staff working, the kitchen, prep, candid team moments.\n" +
      "atmosphere = the room, decor, ambiance, exterior, lighting, empty-space vibe.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: thumbnail.toString("base64") } },
          { type: "text", text: "Which single category key best fits this photo?" },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join(" ")
    .toLowerCase();
  const match = text.match(/food_drink|behind_scenes|events|atmosphere|unsorted/);
  return match && isCategoryKey(match[0]) ? (match[0] as CategoryKey) : "unsorted";
}
