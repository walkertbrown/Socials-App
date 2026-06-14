import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { DesignSpec } from "./templates/types";
import { TEMPLATE_REGISTRY, catalogForPrompt, getTemplate } from "./templates/registry";

// Cost guard: always haiku, never sonnet. The prompt→spec task is a simple
// constrained extraction — haiku handles it at ~1/20th the cost of Sonnet.
const MODEL = "claude-haiku-4-5";

// Takes the user's plain-language prompt and style hint, returns a fully
// validated DesignSpec. Every field maps to a template-approved option.
// On any validation failure, throws so the API route can surface a clear error.
export async function buildDesignSpec(input: {
  prompt: string;
  styleHint: string;
  size: "feed" | "story";
  // Ids of text_safe photos available for photo-background templates.
  availablePhotoIds: string[];
}): Promise<DesignSpec> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");
  const client = new Anthropic({ apiKey });

  const catalog = catalogForPrompt();

  const systemPrompt = `You are the design assistant for The Pelican Club, an elegant upscale French-Quarter restaurant in New Orleans.
Your job is to turn a user's brief into a structured "design spec" — choosing a template, filling its text slots, and selecting a color palette and font pairing.

RULES (non-negotiable):
1. Choose the template whose vibeDescription best matches the request.
2. Fill every REQUIRED slot. Keep copy within the maxChars limit.
3. Choose paletteId from the template's approved palette list only.
4. Choose fontId from the template's approved font list only.
5. If the template is photo-bg and availablePhotoIds is non-empty, set photoId to one of those ids.
   If the template is photo-bg and availablePhotoIds is EMPTY, switch to the nearest non-photo-bg template.
6. Set logoVariant to "dark-bg" if the background is dark/navy/photo; "light-bg" if cream/pale.
7. Return ONLY valid JSON matching the DesignSpec shape below. No prose, no markdown, no code fences.

DesignSpec shape:
{
  "templateId": string,
  "size": "feed" | "story",
  "slots": { [slotKey: string]: string },
  "paletteId": string,
  "fontId": string,
  "logoVariant": "dark-bg" | "light-bg",
  "photoId": string | null
}

TEMPLATE CATALOG:
${catalog}`;

  const userMsg = `Prompt: ${input.prompt}
Style hint: ${input.styleHint || "(none)"}
Desired size: ${input.size}
Available text-safe photo ids (for photo-bg templates): ${
    input.availablePhotoIds.length > 0 ? input.availablePhotoIds.join(", ") : "none"
  }

Return the DesignSpec JSON.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: systemPrompt,
    messages: [{ role: "user", content: userMsg }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join(" ")
    .trim();

  // Parse — extract JSON from the response even if there's stray whitespace.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("AI returned malformed design spec (no JSON object found)");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<DesignSpec>;

  return validateAndClamp(parsed, input.size, input.availablePhotoIds);
}

// Validate every AI-chosen option against the template registry and clamp copy
// to slot limits. Rejects anything off-menu so no freeform output reaches the renderer.
function validateAndClamp(
  raw: Partial<DesignSpec>,
  requestedSize: "feed" | "story",
  availablePhotoIds: string[]
): DesignSpec {
  const templateId = raw.templateId ?? "";
  const template = getTemplate(templateId);
  if (!template) {
    // Fall back to the first solid template.
    const fallback = TEMPLATE_REGISTRY.find((t) => !t.isPhotoBackground)!;
    raw.templateId = fallback.id;
    return validateAndClamp(raw, requestedSize, availablePhotoIds);
  }

  // Size: if the template doesn't support the requested size, use first supported.
  const size: "feed" | "story" = template.sizes.includes(requestedSize)
    ? requestedSize
    : template.sizes[0];

  // Palette: must be in the template's list.
  const palette = template.palettes.find((p) => p.id === raw.paletteId);
  const paletteId = palette?.id ?? template.palettes[0].id;

  // Font: must be in the template's list.
  const font = template.fonts.find((f) => f.id === raw.fontId);
  const fontId = font?.id ?? template.fonts[0].id;

  // Logo variant.
  const logoVariant: "dark-bg" | "light-bg" =
    raw.logoVariant === "light-bg" ? "light-bg" : "dark-bg";

  // Photo id: only valid when template is photo-bg and the id is available.
  let photoId: string | null = null;
  if (template.isPhotoBackground) {
    const pid = typeof raw.photoId === "string" ? raw.photoId : null;
    const validIds = new Set(availablePhotoIds);
    if (pid && validIds.has(pid)) {
      photoId = pid;
    } else if (availablePhotoIds.length > 0) {
      photoId = availablePhotoIds[0];
    }
    // If still no photo, we keep null — the renderer handles a missing photo gracefully.
  }

  // Slots: clamp to maxChars; fill required slots with a fallback if missing.
  const slots: Record<string, string> = {};
  for (const slot of template.slots) {
    const val = (raw.slots ?? {})[slot.key] ?? "";
    slots[slot.key] = String(val).slice(0, slot.maxChars);
    if (slot.required && !slots[slot.key]) {
      slots[slot.key] = "The Pelican Club";
    }
  }

  return { templateId, size, slots, paletteId, fontId, logoVariant, photoId };
}
