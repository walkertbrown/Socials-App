import type { GraphicTemplate } from "../types";

// Event card on a solid/gradient background. Use for live music, private dining,
// wine tastings, trivia nights — anything with a date and a who/what/where.
export const eventSolid: GraphicTemplate = {
  id: "event-solid",
  name: "Event Card — Solid",
  vibeDescription:
    "An elegant event card with date, time, and description on a solid brand background. " +
    "Use for upcoming events: live jazz, wine dinners, happy hour specials, private dining. " +
    "No photo needed — clean and formal.",
  sizes: ["feed", "story"],
  slots: [
    { key: "eyebrow", label: "Event type label (e.g. 'Live Jazz')", maxChars: 9999, required: false },
    { key: "headline", label: "Event name / headline", maxChars: 9999, required: true },
    { key: "date", label: "Date (e.g. 'Friday, June 20')", maxChars: 9999, required: true },
    { key: "time", label: "Time (e.g. '7 PM')", maxChars: 9999, required: false },
    { key: "detail", label: "Supporting detail / description", maxChars: 9999, required: false },
    { key: "cta", label: "Call to action (e.g. 'Reserve your table')", maxChars: 9999, required: false },
  ],
  palettes: [
    {
      id: "navy-gold",
      label: "Navy + Gold (brand default)",
      vars: {
        "--bg": "#1c3149",
        "--bg2": "#0f2035",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--divider": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "deep-plum",
      label: "Deep Plum (evening mood)",
      vars: {
        "--bg": "#2a1628",
        "--bg2": "#1e0f1e",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--divider": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "cream-navy",
      label: "Cream + Navy (day event)",
      vars: {
        "--bg": "#f3ecdd",
        "--bg2": "#ebe0cb",
        "--headline": "#1c3149",
        "--body": "#2d4a68",
        "--accent": "#b8952d",
        "--divider": "#1c3149",
        "--logo-chip": "#1c3149",
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
