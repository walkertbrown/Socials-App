import type { GraphicTemplate } from "./types";
import { announcementSolid } from "./files/announcement-solid";
import { announcementPhoto } from "./files/announcement-photo";
import { eventSolid } from "./files/event-solid";
import { eventPhoto } from "./files/event-photo";
import { holidaySolid } from "./files/holiday-solid";
import { holidayPhoto } from "./files/holiday-photo";
import { quoteFeature } from "./files/quote-feature";
import { hoursCard } from "./files/hours-card";
import { menuFeatureSolid } from "./files/menu-feature-solid";
import { menuFeaturePhoto } from "./files/menu-feature-photo";
import { gradientBrand } from "./files/gradient-brand";

// All available templates, in priority order for the AI prompt. When the AI is
// choosing, it reads vibeDescription to pick the best match. Adding a new
// template here is the ONLY change needed — the AI sees the full list automatically.
export const TEMPLATE_REGISTRY: GraphicTemplate[] = [
  announcementSolid,
  announcementPhoto,
  eventSolid,
  eventPhoto,
  holidaySolid,
  holidayPhoto,
  quoteFeature,
  hoursCard,
  menuFeatureSolid,
  menuFeaturePhoto,
  gradientBrand,
];

// Quick lookup by id. Used by the render layer.
export function getTemplate(id: string): GraphicTemplate | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.id === id);
}

// Template catalog as a compact string for inclusion in the AI system prompt.
// Each line: id | name | vibeDescription | sizes | isPhotoBackground | slot keys
export function catalogForPrompt(): string {
  return TEMPLATE_REGISTRY.map((t) => {
    const slots = t.slots.map((s) => `${s.key}(${s.maxChars})`).join(", ");
    const sizes = t.sizes.join("/");
    const photo = t.isPhotoBackground ? "photo-bg" : "solid";
    return `${t.id} | ${t.name} | ${t.vibeDescription} | ${sizes} | ${photo} | slots: ${slots}`;
  }).join("\n\n");
}
