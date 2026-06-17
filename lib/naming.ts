// Auto-naming helpers for upload-origin photos.
// Physical MinIO keys are never changed — the name lives only in display_name.

import { randomBytes } from "crypto";

// Maps the canonical category keys (from lib/categories.ts) to their Drive folder prefix.
// Deliberately typed as a plain object so we can index it with a string at runtime.
export const categoryToPrefix: Record<string, string> = {
  food_drink: "FOOD",
  behind_scenes: "BTS",
  events: "EVNT",
  atmosphere: "ATMO",
  videos: "VID",
  infographic: "INFO",
  unsorted: "UNSORTED",
};

interface BuildNameArgs {
  prefix: string;
  createdAt: Date;
  /** Vision description — will be slugified; falls back to a short id if empty. */
  description: string;
  /** File extension WITHOUT the dot (e.g. "jpg"). */
  ext: string;
}

// Produces a DB-only display name: "{PREFIX}-{YYYYMMDD}-{slug}.{ext}"
// slug is a kebab-case sanitized excerpt of the description (ascii-folded, a-z0-9 and
// hyphens only, max 40 chars). If the description is empty or collapses to nothing,
// a 6-char random id is used instead so the name is always unique-ish and readable.
export function buildName({ prefix, createdAt, description, ext }: BuildNameArgs): string {
  const date = formatDate(createdAt);
  const slug = slugify(description) || shortId();
  return `${prefix}-${date}-${slug}.${ext}`;
}

// ── Internals ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// Convert a free-text description into a short, filename-safe kebab string.
// Steps: ASCII-fold → lower → strip non-alphanum → collapse spaces to hyphens →
// trim hyphens → truncate to 40 chars.
function slugify(text: string): string {
  return text
    .normalize("NFD")                        // decompose accented chars
    .replace(/[̀-ͯ]/g, "")         // drop combining accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")          // keep only a-z0-9, spaces, hyphens
    .trim()
    .replace(/[\s-]+/g, "-")                 // collapse whitespace/hyphens
    .replace(/^-+|-+$/g, "")                 // trim leading/trailing hyphens
    .slice(0, 40)
    .replace(/-+$/, "");                     // trim if slice cut mid-word
}

// 6-character lowercase hex fallback used when the description is empty/unusable.
function shortId(): string {
  return randomBytes(3).toString("hex");
}
