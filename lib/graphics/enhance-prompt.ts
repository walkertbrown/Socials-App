import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Use Sonnet for the enhance step — the plan specifies it and image-prompt
// expansion benefits from stronger reasoning than haiku.
const MODEL = "claude-sonnet-4-6";

// Takes the user's short prompt and desired format, returns a single rich
// image-generation prompt ready to send to a text-to-image model.
// The enhanced prompt describes scene, composition, style, and mood — and
// may include the headline text the model should render inside the image.
export async function enhancePrompt(input: {
  prompt: string;
  format: "feed" | "story";
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");

  const client = new Anthropic({ apiKey });

  const formatHint =
    input.format === "story"
      ? "The image will be used as an Instagram/Facebook Story (9:16 portrait orientation). Compose the scene vertically."
      : "The image will be used as a social media Feed post (1:1 square). Compose the scene to fill a square frame.";

  const systemPrompt = `You are the design assistant for The Pelican Club, an elegant upscale French-Quarter restaurant in New Orleans.

Your job: take a short brief and rewrite it into a rich, vivid, brand-appropriate image-generation prompt for a text-to-image model.

The Pelican Club brand:
- Upscale, refined, celebratory; rooted in New Orleans culture
- Color palette: deep navy, warm gold, cream, rich jewel tones when festive
- Mood: elegant but warm — French Quarter heritage with modern polish
- The restaurant name or celebratory text should appear in the image when it makes sense

Rules:
1. Write ONE single paragraph — no bullet points, no labels, just the prompt text.
2. Describe scene, composition, lighting, color palette, mood, and style in concrete visual terms.
3. When the occasion calls for text in the image (holiday greeting, event announcement, etc.), describe the typographic element as part of the scene ("elegant gold lettering reads 'Happy Pride Month'").
4. Keep the Pelican Club identity present but not over-branded — one text element or visual nod is enough.
5. Return ONLY the prompt text. No explanation, no preamble, no quotes around it.`;

  const userMsg = `Brief: ${input.prompt}
${formatHint}

Write the image-generation prompt.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  const enhanced = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join(" ")
    .trim();

  if (!enhanced) {
    throw new Error("Claude returned an empty enhanced prompt");
  }

  return enhanced;
}
