// The fixed set of content labels the vision pass may assign to a photo.

export const CONTENT_TAGS = [
  "food",
  "drink",
  "people",
  "exterior",
  "interior",
  "other",
] as const;

export type ContentTag = (typeof CONTENT_TAGS)[number];

export function isContentTag(value: string): value is ContentTag {
  return (CONTENT_TAGS as readonly string[]).includes(value);
}
