import type { GraphicTemplate } from "../types";

// Holiday / seasonal with a venue photo background. The occasion script swoops
// large and the venue name anchors the bottom. Best with atmospheric shots.
export const holidayPhoto: GraphicTemplate = {
  id: "holiday-photo",
  name: "Holiday / Seasonal — Photo",
  vibeDescription:
    "A festive seasonal card with a venue photo as the background. Use for " +
    "Pride, Mardi Gras, New Year's Eve, or any occasion where venue atmosphere " +
    "enhances the celebration. Bold script over a dark scrim. Photo must be text-safe.",
  sizes: ["feed", "story"],
  slots: [
    { key: "occasion", label: "Occasion (e.g. 'Happy Pride')", maxChars: 32, required: true },
    { key: "message", label: "Message from the venue", maxChars: 150, required: false },
    { key: "tagline", label: "Tagline", maxChars: 36, required: false },
  ],
  palettes: [
    {
      id: "dark-scrim",
      label: "Dark gradient scrim",
      vars: {
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(15,28,45,0.85)",
        "--headline": "#e6b94d",
        "--script": "#f3ecdd",
        "--body": "#e0d5c4",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "navy-scrim",
      label: "Navy gradient scrim",
      vars: {
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(28,49,73,0.88)",
        "--headline": "#e6b94d",
        "--script": "#f3ecdd",
        "--body": "#e0d5c4",
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
  isPhotoBackground: true,
};
