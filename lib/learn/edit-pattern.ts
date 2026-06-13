import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getStyleNote, saveStyleNote } from "@/lib/db/style-note";
import { createAdminClient } from "@/lib/supabase/admin";

const MODEL = "claude-haiku-4-5"; // cheapest model — style note is low-stakes
const NOTE_CHAR_CAP = 300; // stored note is capped to keep it terse in the prompt

// COST GUARD (non-negotiable): only make the Claude call when BOTH:
//   - pairs_since_last_run >= 5  (enough new signal to be worth summarizing)
//   - last_generated_at is null OR older than 24 hours  (rate limit)
//
// If either condition fails we return early with no API call.
export async function maybeRefreshStyleNote(): Promise<void> {
  const note = await getStyleNote();

  // Migration not yet applied — silently skip.
  if (!note) return;

  const pairsReady = note.pairs_since_last_run >= 5;
  const stale =
    !note.last_generated_at ||
    Date.now() - new Date(note.last_generated_at).getTime() > 24 * 60 * 60 * 1000;

  // Both gates must be open.
  if (!pairsReady || !stale) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return; // no key, skip silently

  // ── Fetch recent draft/final pairs (bounded — never pull unbounded rows) ────
  const sb = createAdminClient();
  const { data: pairs } = await sb
    .from("scheduled_posts")
    .select("ai_draft, caption")
    .in("status", ["published", "posted"])
    .not("ai_draft", "is", null)
    .not("caption", "is", null)
    .order("published_at", { ascending: false })
    .limit(15); // per spec: window of 15

  if (!pairs?.length) return;

  // Build the comparison text — only include pairs where she actually changed it.
  const comparisons = pairs
    .filter((p) => p.ai_draft !== p.caption)
    .map(
      (p, i) =>
        `Example ${i + 1}:\nAI draft: ${p.ai_draft}\nFinal: ${p.caption}`
    )
    .join("\n\n");

  if (!comparisons) return; // all pairs identical — nothing to learn

  // ── One haiku call to summarize the edit patterns ──────────────────────────
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 120, // enough for 2-4 short bullets; keeps cost minimal
    messages: [
      {
        role: "user",
        content:
          "Look at these AI-drafted vs. final Instagram captions from a New Orleans restaurant. " +
          "Identify 2-4 recurring patterns in how the human edits the AI's draft — " +
          "things she consistently adds, removes, or changes. " +
          "Be specific and terse (bullets, ≤20 words each). " +
          "Return ONLY the bullet list, nothing else.\n\n" +
          comparisons,
      },
    ],
  });

  const rawNote = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join(" ")
    .trim();

  if (!rawNote) return;

  // Cap at NOTE_CHAR_CAP chars at write time so the prompt stays tight.
  const cappedNote = rawNote.slice(0, NOTE_CHAR_CAP);
  await saveStyleNote(cappedNote);
}
