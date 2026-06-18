// segment-guests.ts — assigns a guest to a bucket based on available data.
// Bucket logic is intentionally simple: any guest with notes gets 'personalized'.
// In a later chunk, matched review sentiment will also qualify a guest.

import type { Bucket } from "./types";

interface BucketInput {
  notes: string | null;
}

// 'personalized' if the guest has any free-text notes (tags, preferences, etc.).
// Otherwise 'standard'. This is deterministic and has no side-effects.
export function assignBucket(guest: BucketInput): Bucket {
  return guest.notes?.trim() ? "personalized" : "standard";
}
