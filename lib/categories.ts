// The venue's sorting categories, and how to match each to its Drive subfolder
// (matched by keyword so the "01_", "02_" number prefixes don't matter).

export const CATEGORIES = [
  { key: "food_drink", label: "Food & Drink", match: /food|drink/i },
  { key: "behind_scenes", label: "Behind the Scenes", match: /behind/i },
  { key: "events", label: "Events", match: /event/i },
  { key: "atmosphere", label: "Atmosphere", match: /atmosphere|atmos/i },
  // Holding bin: where the AI sends anything it isn't confident about.
  { key: "unsorted", label: "Unsorted", match: /unsorted/i },
] as const;

// Videos aren't an AI category — they're swept into their own folder. Kept out of
// CATEGORIES so "Videos" never shows up as a board filter chip or a re-file option.
export const VIDEO = { key: "videos", label: "Videos", match: /video/i } as const;

// Cross-cutting "feature" tags the AI may apply to a photo (a photo can carry
// several at once — e.g. a bartender pouring wine = staff + wine + bar). These are
// many-to-many, unlike the single physical category, and power the intent search +
// one-tap filters ("Staff Features"). The AI may also add a few free keywords beyond
// this list for specifics it can see (e.g. "shrimp", "oysters").
export const FEATURE_TAGS = [
  "staff",
  "food",
  "dessert",
  "cocktail",
  "wine",
  "dining room",
  "bar",
  "patio",
  "exterior",
  "event",
  "crowd",
  "live music",
  "holiday",
  "group",
  "portrait",
  "seafood",
] as const;

// Everything that maps to a destination folder (the categories + the videos bin).
export const FOLDER_TARGETS = [...CATEGORIES, VIDEO];

export type CategoryKey = (typeof CATEGORIES)[number]["key"] | "videos";

// The categories the AI is allowed to assign confidently (everything but the bin).
export const SORTABLE = CATEGORIES.filter((c) => c.key !== "unsorted");

export function isCategoryKey(value: string): value is CategoryKey {
  return FOLDER_TARGETS.some((c) => c.key === value);
}

export function labelFor(key: string): string {
  return FOLDER_TARGETS.find((c) => c.key === key)?.label ?? key;
}
