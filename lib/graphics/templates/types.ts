// Template system shapes for the in-app graphic generator.
// Templates are hand-built HTML/CSS — the AI never invents design. It only
// performs a constrained "mail-merge" into a template's defined slots.

// A single text slot the AI can fill (headline, subhead, tagline, etc.).
export interface TextSlot {
  key: string;
  label: string;
  // Soft guide used in the AI prompt so it knows roughly how much copy fits
  // at the default font size. No hard limit is enforced — the renderer scales
  // the font down automatically so any length fits inside the canvas.
  maxChars: number;
  // Whether the slot is required or can be left blank.
  required: boolean;
}

// A pre-approved color palette for one template. The AI picks from this list
// by name — it cannot specify arbitrary hex values.
export interface Palette {
  id: string;
  label: string;
  // CSS custom properties injected into the template root.
  vars: Record<string, string>;
}

// A pre-approved font pairing. Headless Chrome fetches Google Fonts at render.
// Premium font swap note: replace the google import URLs in html.ts with a
// self-hosted woff2 path for any future licensed typeface upgrade.
export interface FontPairing {
  id: string;
  label: string;
  // Google Fonts import URL (injected as <link> in the template HTML).
  googleFontsUrl: string;
  // CSS variable values the template uses.
  displayFamily: string;
  scriptFamily: string;
  sansFamily: string;
}

// Complete template descriptor. Each template lives in templates/files/*.ts.
export interface GraphicTemplate {
  id: string;
  // Human-readable name for the UI and AI prompt context.
  name: string;
  // Vibe/use-case description the AI reads to choose the right template.
  vibeDescription: string;
  // Sizes this template supports.
  sizes: ("feed" | "story")[];
  // Text slots available for the AI to fill.
  slots: TextSlot[];
  // Approved palettes (at least 2). AI selects by id.
  palettes: Palette[];
  // Approved font pairings. AI selects by id.
  fonts: FontPairing[];
  // Whether this template overlays text on a background photo.
  isPhotoBackground: boolean;
}

// The spec the AI produces after reading the user's prompt + style hint.
// Everything in here maps directly to a template's approved options — nothing
// is free-form except the copy strings, which are length-clamped.
export interface DesignSpec {
  templateId: string;
  size: "feed" | "story";
  slots: Record<string, string>;
  paletteId: string;
  fontId: string;
  logoVariant: "dark-bg" | "light-bg";
  // Null when the chosen template is not a photo-background template.
  photoId: string | null;
}
