import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Use Sonnet for the enhance step — the plan specifies it and image-prompt
// expansion benefits from stronger reasoning than haiku.
const MODEL = "claude-sonnet-4-6";

// Takes the user's short prompt, desired format, and optional clarifying answers,
// returns a single rich image-generation prompt ready to send to a text-to-image
// model.  The enhanced prompt describes scene, composition, style, and mood —
// and may include the headline text the model should render inside the image.
export async function enhancePrompt(input: {
  prompt: string;
  format: "feed" | "story";
  answers?: { question: string; answer: string }[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");

  const client = new Anthropic({ apiKey });

  const formatHint =
    input.format === "story"
      ? "The image will be used as an Instagram/Facebook Story (9:16 portrait orientation). Compose the scene vertically."
      : "The image will be used as a social media Feed post (1:1 square). Compose the scene to fill a square frame.";

  const systemPrompt = `You are the design assistant for The Pelican Club, an elegant upscale French-Quarter restaurant in New Orleans.

Your job: take a short brief and rewrite it into a rich, specific image-generation prompt for a text-to-image model. EVERYTHING you write describes a FLAT GRAPHIC-DESIGN POSTER / SOCIAL-MEDIA INFOGRAPHIC — the kind of designed graphic made in Canva or Adobe Illustrator. It is a designed graphic, not a scene.

Write every prompt in the visual language of graphic design:
- THE HEADLINE TEXT IS THE SUBJECT AND MAIN FOCUS of the image — large, bold, and dominant, the first and most important thing the eye lands on. It should occupy a major share of the composition. Everything else exists only to frame and support the words.
- Every other element (color fields, shapes, icons, accents) is SECONDARY DECORATION that supports the text and must never compete with it, crowd it, or overshadow it. Keep decoration simple and sparse.
- Flat vector illustration, clean solid color fields, crisp shapes, editorial/poster layout.
- Pick any decorative accents from the SUBJECT of the brief; never default to a fixed set of motifs (don't reach for ribbons, confetti, or swirls unless the topic truly calls for them).
- A cohesive, limited flat color palette; balanced composition with generous negative space.

The Pelican Club brand:
- Upscale, refined, celebratory; rooted in New Orleans culture.
- Palette leans deep navy, warm gold, and cream — with vibrant flat color when the occasion is festive.
- Keep the identity present but not over-branded — one text element or one simple visual nod is enough.

Write in POSITIVE terms only — describe what the graphic IS. Do NOT write the words photo, photograph, photorealistic, realistic, 3D, render, rendered, cinematic, lighting, bokeh, or depth of field anywhere in your prompt. Fully describing the flat, designed, typographic style leaves no room for a photographic look, so you never need to mention it.

Rules:
1. Write ONE single paragraph — no bullet points, no labels, just the prompt text.
2. Describe the layout, composition, typography, color palette, and flat shapes in concrete graphic-design terms.
3. When the occasion calls for text, put it in the design ("a bold sans-serif headline reads 'HAPPY PRIDE MONTH'").
4. When clarifications from the user are provided, treat them as the highest-priority signal — they override any assumption you'd otherwise make.
5. Return ONLY the prompt text. No explanation, no preamble, no quotes around it.

Examples of the style and quality expected (brief → prompt):

Brief: happy pride month
-> Bold flat graphic-design poster for The Pelican Club celebrating Pride Month. A large confident sans-serif headline reading 'HAPPY PRIDE MONTH' anchors the composition over clean flat color fields in a vibrant rainbow-inspired palette, with crisp vector shapes and a balanced editorial layout that leaves generous negative space. A small refined gold 'Pelican Club' wordmark sits as a tasteful accent.

Brief: wine wednesday, half-off bottles
-> Modern flat-design social poster for Wine Wednesday at The Pelican Club. A strong typographic headline 'WINE WEDNESDAY' sits above a smaller 'Half-Off Bottles' line, set in a refined burgundy-and-cream palette with clean flat shapes and a single simple vector wine-glass accent. Crisp editorial graphic-design layout, elegant and minimal.

Brief: live jazz friday 8pm
-> Flat vector event poster for Live Jazz Friday at The Pelican Club. An elegant typographic hierarchy stacks 'LIVE JAZZ' above 'Friday · 8PM' in a warm gold-on-navy palette with simple flat shapes and a clean screen-printed poster feel. Confident, balanced graphic-design composition.`;

  // Append clarifications block if the caller provided answers.
  const clarificationsBlock =
    input.answers && input.answers.length > 0
      ? "\n\nClarifications from the user:\n" +
        input.answers
          .map((a) => `- ${a.question}: ${a.answer}`)
          .join("\n")
      : "";

  const userMsg = `Brief: ${input.prompt}
${formatHint}${clarificationsBlock}

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

  // Positive style anchor appended to every prompt. Reinforces the flat
  // graphic-design look even if Sonnet's paragraph drifts — all positive
  // language, no "not a photo" negation (which would only make the image
  // model attend to photographs).
  const STYLE_ANCHOR =
    " Flat vector graphic-design illustration — a bold typographic poster where the large headline text is the dominant focal element, with clean flat color fields and only simple supporting decoration.";

  return enhanced + STYLE_ANCHOR;
}
