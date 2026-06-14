import type { GraphicTemplate } from "../types";

// Menu / dish feature with a photo background — ideal when there's a gorgeous
// food or cocktail shot in the library. Photo must be text_safe.
// Dish name in the lower-third safe zone over a scrim.
export const menuFeaturePhoto: GraphicTemplate = {
  id: "menu-feature-photo",
  name: "Menu / Dish Feature — Photo",
  vibeDescription:
    "A dish or cocktail feature with a venue photo as the background. Use when " +
    "you have a beautiful food or drink shot. The dish name and description " +
    "overlay the photo in the lower third over a dark scrim. Photo must be text-safe.",
  sizes: ["feed", "story"],
  slots: [
    { key: "category", label: "Category label (e.g. 'Tonight on the Menu')", maxChars: 9999, required: false },
    { key: "dish", label: "Dish / drink name", maxChars: 9999, required: true },
    { key: "description", label: "Description", maxChars: 9999, required: false },
    { key: "cta", label: "CTA", maxChars: 9999, required: false },
  ],
  palettes: [
    {
      id: "dark-scrim",
      label: "Dark gradient scrim",
      vars: {
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(12,8,4,0.88)",
        "--headline": "#e6b94d",
        "--body": "#f3ecdd",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "navy-scrim",
      label: "Navy gradient scrim",
      vars: {
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(28,49,73,0.90)",
        "--headline": "#e6b94d",
        "--body": "#f3ecdd",
        "--logo-chip": "#f3ecdd",
      },
    },
  ],
  fonts: [
    {
      id: "playfair-pinyon",
      label: "Playfair + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Playfair Display', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
    {
      id: "cormorant-pinyon",
      label: "Cormorant + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,400&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Cormorant Garamond', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
  ],
  isPhotoBackground: true,
};
