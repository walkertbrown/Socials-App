// Shared helpers for the compose screen.
// Keeping them here avoids re-deriving them in unit tests and keeps
// compose-client.tsx under the 300-line ceiling.

import type { PlatformItem } from "@/components/platform-schedule";

export const PIN = "#PelicanClubNOLA";

export function makeItems(when: string, delivery: "auto" | "reminder"): PlatformItem[] {
  return ["instagram", "facebook"].map((p) => ({
    platform: p,
    scheduled_at: when,
    delivery,
    overridden: false,
  }));
}

// Strip hashtag tokens from a caption string and return them separately.
// Used after "Draft with AI" so tags go into the panel, not the caption box.
export function splitCaptionAndTags(text: string): { body: string; tags: string[] } {
  const tags: string[] = [];
  const body = text
    .replace(/#[\w]+/g, (match) => {
      const norm = match.toLowerCase();
      // Skip the pin — it is always present; don't seed it into selectedTags.
      if (norm !== PIN.toLowerCase()) {
        tags.push(norm);
      }
      return "";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
  return { body, tags };
}
