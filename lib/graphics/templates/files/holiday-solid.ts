import type { GraphicTemplate } from "../types";

// Holiday / seasonal celebration card on a solid background.
// Works for Pride, Mardi Gras, New Year's, Valentine's Day, Thanksgiving, etc.
// The eyebrow carries the occasion; the headline is the message from the venue.
export const holidaySolid: GraphicTemplate = {
  id: "holiday-solid",
  name: "Holiday / Seasonal — Solid",
  vibeDescription:
    "A warm, celebratory holiday or seasonal card on a solid background. Use for " +
    "Pride Month, Mardi Gras, New Year's, Valentine's Day, Fourth of July, " +
    "Thanksgiving, or any seasonal occasion. Script accent adds festivity.",
  sizes: ["feed", "story"],
  slots: [
    { key: "occasion", label: "Occasion (e.g. 'Happy Pride')", maxChars: 9999, required: true },
    { key: "message", label: "Message from the venue", maxChars: 9999, required: false },
    { key: "tagline", label: "Closing tagline", maxChars: 9999, required: false },
  ],
  palettes: [
    {
      id: "navy-gold",
      label: "Navy + Gold (elegant celebration)",
      vars: {
        "--bg": "#1c3149",
        "--bg2": "#0f2035",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--script": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "deep-emerald",
      label: "Deep Emerald (Mardi Gras / festive)",
      vars: {
        "--bg": "#0d3320",
        "--bg2": "#081f15",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--script": "#c8a0dc",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "rich-crimson",
      label: "Rich Crimson (Valentine's / festive)",
      vars: {
        "--bg": "#4a0e16",
        "--bg2": "#330a10",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--script": "#f9d0d5",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      // Tasteful six-stop Pride gradient — slightly desaturated / softened for
      // elegance rather than neon. Headline and script in cream so they read
      // over the mid-spectrum bands. Logo chip stays cream for contrast.
      id: "pride-rainbow",
      label: "Pride Rainbow (six-color gradient)",
      vars: {
        "--bg": "linear-gradient(135deg, #c0392b 0%, #d4803a 18%, #c8b820 34%, #2e8b57 50%, #1a5fa8 68%, #7b4fa8 100%)",
        "--bg2": "linear-gradient(135deg, #c0392b 0%, #d4803a 18%, #c8b820 34%, #2e8b57 50%, #1a5fa8 68%, #7b4fa8 100%)",
        "--headline": "#f3ecdd",
        "--body": "#f8f2e6",
        "--accent": "#f3ecdd",
        "--script": "#ffffff",
        "--logo-chip": "#f3ecdd",
      },
    },
  ],
  fonts: [
    {
      id: "playfair-pinyon",
      label: "Playfair + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Playfair Display', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
    {
      id: "cormorant-pinyon",
      label: "Cormorant + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Cormorant Garamond', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
  ],
  isPhotoBackground: false,
};
