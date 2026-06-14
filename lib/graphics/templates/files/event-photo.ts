import type { GraphicTemplate } from "../types";

// Event card with a venue photo background — pairs well with atmosphere shots
// of the bar, candlelit tables, or a live music setup.
export const eventPhoto: GraphicTemplate = {
  id: "event-photo",
  name: "Event Card — Photo",
  vibeDescription:
    "An event card with a venue photo as background atmosphere. Use when the venue " +
    "itself is the selling point — atmospheric shots of candlelit tables, the bar, " +
    "the stage. Date and name over a dark scrim in lower third.",
  sizes: ["feed", "story"],
  slots: [
    { key: "eyebrow", label: "Event type label", maxChars: 9999, required: false },
    { key: "headline", label: "Event name", maxChars: 9999, required: true },
    { key: "date", label: "Date", maxChars: 9999, required: true },
    { key: "time", label: "Time", maxChars: 9999, required: false },
    { key: "cta", label: "Call to action", maxChars: 9999, required: false },
  ],
  palettes: [
    {
      id: "dark-scrim",
      label: "Dark gradient scrim",
      vars: {
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(15,28,45,0.88)",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--divider": "#e6b94d",
        "--logo-chip": "#f3ecdd",
      },
    },
    {
      id: "navy-scrim",
      label: "Navy gradient scrim",
      vars: {
        "--scrim-start": "rgba(0,0,0,0.0)",
        "--scrim-end": "rgba(28,49,73,0.92)",
        "--headline": "#f3ecdd",
        "--body": "#e0d5c4",
        "--accent": "#e6b94d",
        "--divider": "#e6b94d",
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
