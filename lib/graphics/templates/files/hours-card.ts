import type { GraphicTemplate } from "../types";

// Hours card — open today, closed, holiday hours. Quick and clear.
// Solid navy background; gold accent on the hours text so it pops.
// Doubles as a "we're open!" reminder post or a holiday closure notice.
export const hoursCard: GraphicTemplate = {
  id: "hours-card",
  name: "Hours / Open Today",
  vibeDescription:
    "A clean hours card: open today, holiday hours, or closed notice. " +
    "Use for 'We're open tonight!', Christmas Eve hours, or a brief closure. " +
    "Solid background; no photo needed. Clear, readable, practical.",
  sizes: ["feed", "story"],
  slots: [
    { key: "status", label: "Status label (e.g. 'Open Today' / 'Holiday Hours')", maxChars: 28, required: true },
    { key: "hours", label: "Hours (e.g. '5 PM – 10 PM')", maxChars: 30, required: true },
    { key: "note", label: "Note / caveat (e.g. 'Reservations recommended')", maxChars: 70, required: false },
    { key: "tagline", label: "Closing tagline", maxChars: 36, required: false },
  ],
  palettes: [
    {
      id: "navy-gold",
      label: "Navy + Gold (brand default)",
      vars: {
        "--bg": "#1c3149",
        "--bg2": "#162840",
        "--headline": "#f3ecdd",
        "--hours": "#e6b94d",
        "--body": "#e0d5c4",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "cream-navy",
      label: "Cream + Navy (daytime)",
      vars: {
        "--bg": "#f3ecdd",
        "--bg2": "#ebe0cb",
        "--headline": "#1c3149",
        "--hours": "#b8952d",
        "--body": "#2d4a68",
        "--logo-chip": "#1c3149",
      },
    },
  ],
  fonts: [
    {
      id: "playfair-pinyon",
      label: "Playfair + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Pinyon+Script&family=Montserrat:wght@400;500;600&display=swap",
      displayFamily: "'Playfair Display', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
    {
      id: "cormorant-pinyon",
      label: "Cormorant + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Pinyon+Script&family=Montserrat:wght@400;500;600&display=swap",
      displayFamily: "'Cormorant Garamond', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
  ],
  isPhotoBackground: false,
};
