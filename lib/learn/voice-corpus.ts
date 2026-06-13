import "server-only";
import { getPostedCaptions, getExemplarCaptions } from "@/lib/db/learning-posts";
import { SEED_CAPTIONS } from "@/lib/db/seed-captions";

// Minimum examples to include in the voice corpus before calling the model.
const MIN_EXAMPLES = 7;
// Hard cap — keeps the prompt token budget predictable.
const MAX_EXAMPLES = 10;

// Build the ordered list of voice examples to put in the caption-drafting prompt.
//
// Priority order:
//   1. Exemplars (pinned by her — always in)
//   2. Recent posted captions in the same category (most-reach first)
//   3. Recent global posted captions (top-up when category pool is thin)
//   4. Seed captions (cold-start fallback when the posted pool is empty)
//
// Each group dedups by caption text so a popular exemplar doesn't eat two slots.
export async function buildVoiceCorpus(category?: string | null): Promise<string[]> {
  const seen = new Set<string>();
  const result: string[] = [];

  function add(caption: string) {
    const key = caption.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(key);
  }

  // ── Step 1: exemplars (always included, regardless of category) ────────────
  try {
    const exemplars = await getExemplarCaptions();
    for (const e of exemplars) add(e.caption);
  } catch {
    // DB not yet set up (migration pending) — fall through to seeds
  }

  // ── Step 2: category-specific recent posts (reach-sorted) ─────────────────
  if (category) {
    try {
      const catPosts = await getPostedCaptions({ category, limit: MAX_EXAMPLES });
      // Sort by reach descending so higher-performing captions come first.
      catPosts
        .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
        .forEach((p) => add(p.caption));
    } catch {
      // DB not yet migrated — fall through
    }
  }

  // ── Step 3: global top-up if still below minimum ───────────────────────────
  if (result.length < MIN_EXAMPLES) {
    try {
      const global = await getPostedCaptions({ limit: MAX_EXAMPLES });
      global
        .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
        .forEach((p) => add(p.caption));
    } catch {
      // Fall through to seeds
    }
  }

  // ── Step 4: seed fallback (cold start — zero posted rows) ─────────────────
  if (result.length < MIN_EXAMPLES) {
    for (const s of SEED_CAPTIONS) {
      if (result.length >= MIN_EXAMPLES) break;
      add(s);
    }
  }

  // Cap the final list so we don't blow the prompt budget.
  return result.slice(0, MAX_EXAMPLES);
}
