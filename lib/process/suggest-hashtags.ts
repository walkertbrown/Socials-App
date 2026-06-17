import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

// Mirror draft-caption.ts — same model constant, same client setup.
const MODEL = "claude-haiku-4-5";

// One Claude call: read the caption text + the photo's stored description/tags
// (no image fetching — text only) and return ~8-12 relevant lowercase hashtags
// as a newline-separated plain list.
//
// Cost guards enforced here:
//   • max_tokens: 80  (guard #5)
//   • MODEL = "claude-haiku-4-5" hard-coded, not from env (guard #6)
//   • No image input — text only (guard #7)
export async function suggestHashtags(caption: string, photoId: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const supabase = createAdminClient();

  // Fetch the photo's stored vision signals — text only, never the image.
  const { data: photo } = await supabase
    .from("photos")
    .select("description, tags")
    .eq("id", photoId)
    .maybeSingle();

  // Build the prompt. Gracefully handles missing photo or missing vision data.
  const photoContext: string[] = [];
  if (photo?.description) {
    photoContext.push(`Photo description: ${photo.description}`);
  }
  if (photo?.tags && Array.isArray(photo.tags) && photo.tags.length > 0) {
    photoContext.push(`Photo tags: ${(photo.tags as string[]).join(", ")}`);
  }

  const contextLine =
    photoContext.length > 0
      ? photoContext.join(". ") + "."
      : "No additional photo context available.";

  const prompt =
    "You suggest Instagram/Facebook hashtags for The Pelican Club — an upscale restaurant and bar in the French Quarter, New Orleans.\n\n" +
    `Caption: ${caption}\n` +
    `${contextLine}\n\n` +
    "Return 8-12 relevant, specific, lowercase hashtags (with #). " +
    "One hashtag per line. No explanation, no commentary — just the hashtags. " +
    "Prefer specific over generic: #nolacocktails over #drinks. " +
    "Never repeat #PelicanClubNOLA — it is always added separately. " +
    "Focus on what is actually in the photo/caption.";

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 80, // guard #5 — tight budget forces concise list output
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  // Parse lines that look like hashtags; ignore blank lines or stray text.
  return raw
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.startsWith("#") && line.length > 1);
}
