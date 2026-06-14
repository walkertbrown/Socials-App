import type { GraphicTemplate } from "../types";

// Photo-background announcement — same message as the solid version but with
// a venue photo behind a dark scrim. The AI only selects text_safe photos.
// Text lives in the lower-third safe zone; the scrim ensures legibility.
export const announcementPhoto: GraphicTemplate = {
  id: "announcement-photo",
  name: "Announcement — Photo",
  vibeDescription:
    "A bold announcement with a venue photo as background. Use when you want visual " +
    "atmosphere behind the message — cocktail bar, dining room, patio. The photo must " +
    "be text-safe (clear focal point, good exposure). Text in lower third.",
  sizes: ["feed", "story"],
  slots: [
    { key: "eyebrow", label: "Eyebrow", maxChars: 9999, required: false },
    { key: "headline", label: "Headline", maxChars: 9999, required: true },
    { key: "subhead", label: "Subhead", maxChars: 9999, required: false },
    { key: "tagline", label: "Tagline / CTA", maxChars: 9999, required: false },
  ],
  palettes: [
    {
      id: "dark-scrim",
      label: "Dark gradient scrim (standard)",
      vars: {
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(15,28,45,0.88)",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "navy-scrim",
      label: "Navy gradient scrim (brand-heavy)",
      vars: {
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(28,49,73,0.90)",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--logo-chip": "#f3ecdd",
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
  isPhotoBackground: true,
};
