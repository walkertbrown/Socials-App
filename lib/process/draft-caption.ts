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
export async function draftCaption(
  photoId: string,
  platform: "facebook" | "instagram",
  intent?: string
): Promise<string> {
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
      ? `Prefer these real hashtags she uses (pick the 5 most relevant): ${topTags.join(" ")}. `
      : "";

  // ── Per-platform voice + call-to-action (her FB↔IG rubric) ──────────────────
  const isFacebook = platform === "facebook";

  // Audience + register: FB skews older and not-trendy; IG is discovery-minded.
  const audienceLine = isFacebook
    ? "This caption is for FACEBOOK. The audience skews older (think someone your parents' age). Write warm and clear, the way you'd tell your parents about a place they'd think is cool. Keep it purposeful: do not be trendy, slangy, or overly chatty. "
    : "This caption is for INSTAGRAM. The audience is local foodies of all ages plus visitors discovering the place, so you can be a little more current, and a light touch of local or French Quarter flavor is welcome. ";

  // CTA mechanics differ: FB pastes the OpenTable link; IG points to link in bio.
  const ctaLine = isFacebook
    ? 'End with a clear reservation call-to-action that works the OpenTable link into a sentence, with the full URL written out, e.g. "Reservations are going fast, so grab your table: https://www.opentable.com/the-pelican-club-new-orleans". '
    : 'End with a reservation nudge that points to the profile link, e.g. "Reserve at the link in bio" or "Tap the reserve link on our profile". Never paste a raw web address. ';

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
        "You write social captions for The Pelican Club, an upscale restaurant and bar in the French Quarter, New Orleans, serving since 1990. " +
        intentLine +
        grounding +
        styleLine +
        tagLine +
        `This is a "${labelFor(photo.category ?? "")}" photo. Write ONE caption in the house voice. ` +
        audienceLine +
        "Shape it as a short hook, then describe what's in the photo invitingly, then the call-to-action, all in 2 to 3 very short paragraphs. " +
        ctaLine +
        "Use 1-2 emoji and end with exactly 5 hashtags starting with #PelicanClubNOLA. " +
        "Voice rules (important): warm and professional, never quippy or gimmicky. " +
        'Do NOT use em dashes. A normal hyphen "-" is fine, but never the long dash that looks like two hyphens joined together. ' +
        "Never downplay or devalue the regular menu to make a special sound better; describe everything as worth wanting. " +
        'Be concrete and specific; avoid flowery filler like "magic", "memories are made", "elevate", or "nestled". ' +
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
