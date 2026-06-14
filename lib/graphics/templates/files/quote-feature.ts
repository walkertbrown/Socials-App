import type { GraphicTemplate } from "../types";

// Quote / testimonial / statement card. Clean typographic layout — the quote
// is the star. Works beautifully on a solid gradient background with a large
// script ornament for visual weight.
export const quoteFeature: GraphicTemplate = {
  id: "quote-feature",
  name: "Quote / Feature Statement",
  vibeDescription:
    "A typographic quote or brand statement card. Use for guest reviews, " +
    "a meaningful line from the menu, an owner message, a seasonal mantra, " +
    "or a brand promise. No photo — let the words do the work.",
  sizes: ["feed", "story"],
  slots: [
    { key: "quote", label: "The quote or statement", maxChars: 9999, required: true },
    { key: "attribution", label: "Attribution (e.g. '— A Happy Guest')", maxChars: 9999, required: false },
    { key: "tagline", label: "Footer tagline", maxChars: 9999, required: false },
  ],
  palettes: [
    {
      id: "navy-gold",
      label: "Navy + Gold",
      vars: {
        "--bg": "#1c3149",
        "--bg2": "#162840",
        "--quote": "#f3ecdd",
        "--attribution": "#e6b94d",
        "--tagline": "#b5c9d8",
        "--ornament": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "cream-navy",
      label: "Cream + Navy (bright mood)",
      vars: {
        "--bg": "#f3ecdd",
        "--bg2": "#ebe0cb",
        "--quote": "#1c3149",
        "--attribution": "#b8952d",
        "--tagline": "#4a6a84",
        "--ornament": "#e6b94d",
        "--logo-chip": "#1c3149",
      },
    },
    {
      id: "charcoal-gold",
      label: "Charcoal + Gold (dramatic)",
      vars: {
        "--bg": "#1a1a1a",
        "--bg2": "#111111",
        "--quote": "#f3ecdd",
        "--attribution": "#e6b94d",
        "--tagline": "#a0a0a0",
        "--ornament": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
  ],
  fonts: [
    {
      id: "playfair-pinyon",
      label: "Playfair + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Playfair Display', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
    {
      id: "cormorant-pinyon",
      label: "Cormorant + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Cormorant Garamond', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
  ],
  isPhotoBackground: false,
};
