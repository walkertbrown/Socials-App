import type { GraphicTemplate } from "../types";

// Solid navy/cream announcement card — for grand openings, special occasions,
// anything that deserves a statement. No photo needed; brand alone carries it.
export const announcementSolid: GraphicTemplate = {
  id: "announcement-solid",
  name: "Announcement — Solid",
  vibeDescription:
    "A bold branded announcement on a solid background. Use for special news, " +
    "milestones, new menu items, or any statement post that needs to command attention. " +
    "Elegant and formal — no photo needed.",
  sizes: ["feed", "story"],
  slots: [
    { key: "eyebrow", label: "Eyebrow (small label above headline)", maxChars: 9999, required: false },
    { key: "headline", label: "Headline", maxChars: 9999, required: true },
    { key: "subhead", label: "Subhead / supporting detail", maxChars: 9999, required: false },
    { key: "tagline", label: "Tagline / call-to-action", maxChars: 9999, required: false },
  ],
  palettes: [
    {
      id: "navy-gold",
      label: "Navy + Gold (brand default)",
      vars: {
        "--bg": "#1c3149",
        "--bg2": "#162840",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "cream-navy",
      label: "Cream + Navy (light mode)",
      vars: {
        "--bg": "#f3ecdd",
        "--bg2": "#ebe0cb",
        "--headline": "#1c3149",
        "--body": "#2d4a68",
        "--accent": "#e6b94d",
        "--logo-chip": "#1c3149",
      },
    },
    {
      id: "gold-navy",
      label: "Deep Gold + Navy",
      vars: {
        "--bg": "#e6b94d",
        "--bg2": "#d4a63a",
        "--headline": "#1c3149",
        "--body": "#1c3149",
        "--accent": "#1c3149",
        "--logo-chip": "#1c3149",
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
  isPhotoBackground: false,
};
