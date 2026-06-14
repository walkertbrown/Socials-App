import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { labelFor } from "@/lib/categories";
import { buildVoiceCorpus } from "@/lib/learn/voice-corpus";
import { getStyleNote } from "@/lib/db/style-note";
import { getTopHashtags } from "@/lib/learn/hashtag-vocab";

const MODEL = "claude-haiku-4-5";

// One Claude call: look at the photo + its category (+ what she wants the post
// to be about, if she said), return a caption + hashtags.
//
// Voice corpus, style notes, and hashtags all come from learning-loop data
// (her real posted captions) so the drafts improve over time automatically.
export async function draftCaption(photoId: string, intent?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const supabase = createAdminClient();

  const { data: photo } = await supabase
    .from("photos")
    .select("thumbnail_path, category, description, tags")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) throw new Error("Photo not found");

  // ── Learning signals (all gracefully degrade if DB not migrated yet) ────────

  // Voice corpus: exemplars → recent posted → seeds.  Never empty (has fallback).
  const voiceExamples = await buildVoiceCorpus(photo.category);

  // Style note: 2-4 bullets summarising her edit patterns (or null if none yet).
  let styleNoteText: string | null = null;
  try {
    const sn = await getStyleNote();
    styleNoteText = sn?.note ?? null;
  } catch {
    // Migration pending — skip
  }

  // Hashtags she actually uses for this category (prompt suggestion, not mandate).
  let topTags: string[] = [];
  try {
    topTags = await getTopHashtags(photo.category);
  } catch {
    // Migration pending or empty vocab — skip
  }

  // ── Thumbnail ────────────────────────────────────────────────────────────────

  let imageData: string | null = null;
  if (photo.thumbnail_path) {
    const { data: signed } = await supabase.storage
      .from("thumbnails")
      .createSignedUrl(photo.thumbnail_path, 120);
    if (signed?.signedUrl) {
      const resp = await fetch(signed.signedUrl);
      imageData = Buffer.from(await resp.arrayBuffer()).toString("base64");
    }
  }

  // ── Prompt assembly ──────────────────────────────────────────────────────────

  const voiceLine =
    voiceExamples.length > 0
      ? `Match the voice of these real example captions:\n${voiceExamples.map((e) => `- ${e}`).join("\n")}`
      : "Use a warm, inviting, on-brand restaurant/bar social-media voice.";

  // What she typed in the intent box, if anything.
  const intentLine = intent?.trim()
    ? `The person posting wants this post to be specifically about: "${intent.trim()}". Center the caption on that angle (while staying true to what's actually in the photo). `
    : "";

  // Stored AI notes about what's visible in the photo — keeps the caption accurate.
  const grounding = photo.description
    ? `For reference, what's visible in the photo: ${photo.description} `
    : "";

  // Hashtag suggestion line — real tags she uses, not invented ones.
  const tagLine =
    topTags.length > 0
      ? `Prefer these real hashtags she uses (pick the most relevant 4-6): ${topTags.join(" ")}. `
      : "";

  // Style-note line — her recurring edits distilled into 2-4 bullets.
  const styleLine = styleNoteText
    ? `Her typical edits to AI drafts (follow these patterns): ${styleNoteText} `
    : "";

  const content = [
    ...(imageData
      ? [
          {
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data: imageData },
          },
        ]
      : []),
    {
      type: "text" as const,
      text:
        "You write Instagram/Facebook captions for The Pelican Club — an upscale restaurant and bar in the French Quarter, New Orleans, serving since 1990. " +
        intentLine +
        grounding +
        styleLine +
        tagLine +
        `This is a "${labelFor(photo.category ?? "")}" photo. Write ONE caption in the house voice: ` +
        "open with a short hook or vivid line, describe what's in the photo invitingly, add a reservation nudge " +
        '("Reservations at the link in bio" or via OpenTable), use 1-2 emoji, then 4-6 hashtags starting with #PelicanClubNOLA. ' +
        'Be concrete and specific with a little dry wit — avoid flowery filler like "magic", "memories are made", "elevate", or "nestled". ' +
        voiceLine +
        " Return only the caption text, nothing else.",
    },
  ];

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 220,
    messages: [{ role: "user", content }],
  });
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join(" ")
    .trim();
}
