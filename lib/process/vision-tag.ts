import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { SORTABLE, FEATURE_TAGS, isCategoryKey, type CategoryKey } from "@/lib/categories";

const MODEL = "claude-haiku-4-5";

export interface PhotoAnalysis {
  category: CategoryKey;
  // 1–2 plain sentences of ONLY what's visible — used for intent search, never shown to guests.
  description: string;
  // Cross-cutting tags (feature tags that apply + a few specific keywords).
  tags: string[];
}

// One vision call per photo: sort it into a category AND describe it for search.
// Combining both into a single call keeps cost at one image upload per photo — the
// description/tags are just extra output tokens, not a second image send.
export async function analyzePhoto(thumbnail: Buffer): Promise<PhotoAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey });

  const keys = SORTABLE.map((c) => c.key).join(", ");
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You sort and describe a New Orleans restaurant's social-media photos for an internal library. " +
      "Return ONLY a JSON object, no prose, with keys: category, description, tags.\n\n" +
      `category = exactly one of: ${keys}, or "unsorted" if none clearly fits.\n` +
      "food_drink = dishes, drinks, plating, close-ups of food or cocktails.\n" +
      "events = a party, show, live music, special event, a busy event crowd.\n" +
      "behind_scenes = staff working, the kitchen, prep, candid team moments.\n" +
      "atmosphere = the room, decor, ambiance, exterior, lighting, empty-space vibe.\n\n" +
      "description = 1–2 short, plain sentences describing ONLY what is literally visible " +
      "(subjects, food/drink items, setting, lighting, day/night). This is for search, so be concrete. " +
      "Do NOT guess or invent people's names, the names of events, or specific menu-item names you can't be sure of — " +
      "describe what you see (e.g. 'a bartender pouring red wine', not a person's name).\n\n" +
      `tags = a JSON array of lowercase tags. Include any of these that apply: ${FEATURE_TAGS.join(", ")}. ` +
      "Then add up to 3 specific visible keywords (e.g. 'shrimp', 'oysters', 'manhattan'). " +
      "Never invent a person's name as a tag.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: thumbnail.toString("base64") } },
          { type: "text", text: "Sort and describe this photo. Return only the JSON object." },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join(" ");

  return parseAnalysis(text);
}

// Tolerant parse: pull the first {...} block and validate each field, falling back
// to safe defaults so a malformed reply never throws mid-sort.
function parseAnalysis(text: string): PhotoAnalysis {
  let category: CategoryKey = "unsorted";
  let description = "";
  let tags: string[] = [];

  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const obj = JSON.parse(text.slice(start, end + 1));
      const cat = String(obj.category ?? "").toLowerCase().trim();
      if (isCategoryKey(cat)) category = cat as CategoryKey;
      if (typeof obj.description === "string") description = obj.description.trim();
      if (Array.isArray(obj.tags)) {
        tags = obj.tags
          .map((t: unknown) => String(t).toLowerCase().trim())
          .filter((t: string) => t.length > 0 && t.length < 40);
      }
    }
  } catch {
    // Fall through to defaults; a bad parse just yields an unsorted, untagged photo.
  }

  // De-dupe tags, keep them bounded.
  tags = Array.from(new Set(tags)).slice(0, 12);
  return { category, description, tags };
}
