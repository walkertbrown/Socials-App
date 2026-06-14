import type { GraphicTemplate } from "../types";

// Menu / dish feature — solid background. For spotlighting a cocktail, entree,
// or specialty without a photo. Text-forward, refined, appetite-whetting.
export const menuFeatureSolid: GraphicTemplate = {
  id: "menu-feature-solid",
  name: "Menu / Dish Feature — Solid",
  vibeDescription:
    "A refined menu or dish feature card on a solid background. Use to spotlight " +
    "a signature cocktail, seasonal entree, dessert, or wine. No photo needed — " +
    "evocative copy and brand typography carry the appetite appeal.",
  sizes: ["feed", "story"],
  slots: [
    { key: "category", label: "Category label (e.g. 'Cocktail of the Month')", maxChars: 32, required: false },
    { key: "dish", label: "Dish / drink name", maxChars: 40, required: true },
    { key: "description", label: "Evocative description", maxChars: 90, required: false },
    { key: "price", label: "Price (optional)", maxChars: 12, required: false },
    { key: "cta", label: "Call to action", maxChars: 36, required: false },
  ],
  palettes: [
    {
      id: "navy-gold",
      label: "Navy + Gold",
      vars: {
        "--bg": "#1c3149",
        "--bg2": "#162840",
        "--headline": "#e6b94d",
        "--body": "#e0d5c4",
        "--accent": "#f3ecdd",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "warm-charcoal",
      label: "Warm Charcoal (food mood)",
      vars: {
        "--bg": "#2a2016",
        "--bg2": "#1c1510",
        "--headline": "#e6b94d",
        "--body": "#e0d5c4",
        "--accent": "#f3ecdd",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "cream-navy",
      label: "Cream + Navy (lunch / brunch)",
      vars: {
        "--bg": "#f3ecdd",
        "--bg2": "#ebe0cb",
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
        "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Playfair Display', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
    {
      id: "cormorant-pinyon",
      label: "Cormorant + Pinyon Script",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Pinyon+Script&family=Montserrat:wght@400;500&display=swap",
      displayFamily: "'Cormorant Garamond', Georgia, serif",
      scriptFamily: "'Pinyon Script', cursive",
      sansFamily: "'Montserrat', sans-serif",
    },
  ],
  isPhotoBackground: false,
};
