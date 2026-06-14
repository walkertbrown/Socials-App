import type { GraphicTemplate } from "../types";

// Brand gradient card — a soft diagonal gradient between brand hues with
// generous whitespace and a centered centered composition. Versatile: works for
// general brand-voice posts, "thank you" moments, milestones, or ambient content.
export const gradientBrand: GraphicTemplate = {
  id: "gradient-brand",
  name: "Brand Gradient",
  vibeDescription:
    "A soft gradient card for general brand posts, milestones, thank-yous, or " +
    "ambient content when no specific event or dish is being featured. Centered " +
    "composition with generous whitespace. Very versatile.",
  sizes: ["feed", "story"],
  slots: [
    { key: "headline", label: "Main message / headline", maxChars: 55, required: true },
    { key: "subhead", label: "Supporting line", maxChars: 80, required: false },
    { key: "tagline", label: "Tagline", maxChars: 36, required: false },
  ],
  palettes: [
    {
      id: "navy-to-deep",
      label: "Navy → Deep Navy gradient",
      vars: {
        "--grad-a": "#1c3149",
        "--grad-b": "#0d1f30",
        "--grad-angle": "135deg",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "navy-to-plum",
      label: "Navy → Plum gradient (evening)",
      vars: {
        "--grad-a": "#1c3149",
        "--grad-b": "#2a1628",
        "--grad-angle": "135deg",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "cream-to-warm",
      label: "Cream → Warm gradient (daytime)",
      vars: {
        "--grad-a": "#f3ecdd",
        "--grad-b": "#ebe0cb",
        "--grad-angle": "135deg",
        "--headline": "#1c3149",
        "--body": "#3d5a76",
        "--accent": "#b8952d",
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
