import type { GraphicTemplate } from "../types";

// Flexible / generative template — used when the prompt doesn't closely match
// any of the 11 specific templates (e.g. "happy pride", "fall harvest",
// "blue ocean vibes"). The layout, typography, and logo are fully designed here;
// only the BACKGROUND is AI-supplied as a validated CSS gradient or hex value.
//
// The template always renders a subtle scrim + high-contrast cream text so the
// copy stays legible regardless of what background the AI chooses.
export const flexibleTemplate: GraphicTemplate = {
  id: "flexible",
  name: "Flexible / Generative",
  vibeDescription:
    "A clean, elegant centered-text layout for any occasion or mood that does not " +
    "clearly match another template. The AI supplies a background color or gradient " +
    "that fits the topic. Use when the prompt is creative, thematic, or seasonal " +
    "without an obvious event, holiday, announcement, or menu peg — for example: " +
    "'happy pride', 'fall harvest vibes', 'ocean breeze summer cocktails', " +
    "'celebrate love', or any colorful / mood-based request.",
  sizes: ["feed", "story"],
  slots: [
    // Occasion is the large script-style top line (e.g. "Happy Pride")
    { key: "occasion", label: "Occasion / theme", maxChars: 40, required: true },
    // Message is the supporting copy — 150 chars now that subhead wraps.
    { key: "message", label: "Message from the venue", maxChars: 150, required: false },
    { key: "tagline", label: "Closing tagline / venue name", maxChars: 44, required: false },
    // background is injected by the AI — validated to hex or linear-gradient only.
    // It is NOT shown in the tweak UI (the renderer reads it directly from slots).
    { key: "background", label: "Background (CSS gradient or hex — AI only)", maxChars: 300, required: false },
  ],
  palettes: [
    {
      // High-contrast cream text — used for all flexible renders regardless of
      // background. The background slot overrides the canvas color.
      id: "cream-on-any",
      label: "Cream text (works on any background)",
      vars: {
        "--bg": "#1c3149",   // fallback only; AI background overrides this
        "--bg2": "#0f2035",
        "--headline": "#f3ecdd",
        "--body": "#f0e8d8",
        "--accent": "#f3ecdd",
        "--script": "#ffffff",
        "--logo-chip": "#f3ecdd",
        // The scrim ensures cream text is always readable over the AI background.
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(0,0,0,0.42)",
      },
    },
    {
      // Slightly warmer cream alternative — for very light AI backgrounds.
      id: "white-on-any",
      label: "White text (stronger contrast)",
      vars: {
        "--bg": "#1c3149",
        "--bg2": "#0f2035",
        "--headline": "#ffffff",
        "--body": "#f5f5f5",
        "--accent": "#f3ecdd",
        "--script": "#ffffff",
        "--logo-chip": "#f3ecdd",
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(0,0,0,0.52)",
      },
    },
  ],
  fonts: [
    {
      id: "playfair-pinyon",
      label: "Playfair + Pinyon Script (refined)",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Playfair Display', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
    {
      id: "cormorant-pinyon",
      label: "Cormorant + Pinyon Script (ultra-refined)",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Cormorant Garamond', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
  ],
  // Not a photo-background template — background comes from the AI slot.
  isPhotoBackground: false,
};
