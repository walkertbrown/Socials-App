import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { labelFor } from "@/lib/categories";

const MODEL = "claude-haiku-4-5";

// Real Pelican Club captions, used to teach Claude the house voice.
const VOICE_EXAMPLES: string[] = [
  "Our BBQ shrimp needs no introduction. Head-on, served in cast iron, with toasted focaccia bread for the sauce — on the menu every night, Wednesday through Sunday. 🦐 Reserve via link in bio. #pelicanclubNOLA #bbqshrimp #NewOrleansEats #FrenchQuarterDining",
  "You haven't had a Manhattan until you've had ours. The Black Cherry Manhattan — Four Roses bourbon, Amaro, Luxardo, and just the right amount of dark and dangerous. #pelicanclubNOLA #blackcherrymanhattan #craftcocktails #frenchquarter",
  "The tall ships head out tomorrow, but the real treasure was in the French Quarter the whole time. ⚓ Pelican Club's Baked Oysters: applewood smoked bacon, parmesan, garlic herb butter, broiled until the edges crisp up. Reservations on OpenTable, link in bio. 🔗 #pelicanclubNOLA #bakedoysters #frenchquarterdining #neworleans",
  "CJ keeps the whole operation running smoothly, and has excellent taste in wine! We're pouring the En Route Les Pommiers Pinot Noir — cherry, bergamot, and a little something earthy that keeps you coming back for another sip. We're back tonight…come find out for yourself. #pelicanclubNOLA #pinotnoir #frenchquarterdining #nolaeats",
  "New Orleans knows how to celebrate. So do we. Book your special event, business meeting, or date night at The Pelican Club and make it a night they'll actually remember. 🥂 Reserve now at the link in our bio. #pelicanclubNOLA #frenchquarterdining #CelebrateinNOLA #neworleansrestaurants",
  "New menu. Same heritage, since 1990. 🦩 New dishes and returning favorites are waiting for you. Reserve your table at the link in bio. #PelicanClubNOLA #NewOrleansRestaurants #FrenchQuarterEats #FineDiningNOLA",
  "Closed today in observance of Memorial Day. Grateful for everyone who has made The Pelican Club part of their table. Back Wednesday — we'll have a seat waiting for you. #pelicanclubNOLA #memorialday #neworleans #frenchquarterdining",
];

// One Claude call: look at the photo + its category (+ what she wants the post to
// be about, if she said), return a caption + hashtags.
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

  const voice = VOICE_EXAMPLES.length
    ? `Match the voice of these real example captions:\n${VOICE_EXAMPLES.map((e) => `- ${e}`).join("\n")}`
    : "Use a warm, inviting, on-brand restaurant/bar social-media voice.";

  // What she typed in the intent box, if anything — the caption should center on this.
  const intentLine = intent?.trim()
    ? `The person posting wants this post to be specifically about: "${intent.trim()}". Center the caption on that angle (while staying true to what's actually in the photo). `
    : "";

  // Stored AI notes about what's in the photo — grounding so the caption stays accurate.
  const grounding = photo.description
    ? `For reference, what's visible in the photo: ${photo.description} `
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
        `This is a "${labelFor(photo.category ?? "")}" photo. Write ONE caption in the house voice: ` +
        "open with a short hook or vivid line, describe what's in the photo invitingly, add a reservation nudge " +
        '("Reservations at the link in bio" or via OpenTable), use 1-2 emoji, then 4-6 hashtags starting with #PelicanClubNOLA. ' +
        'Be concrete and specific with a little dry wit — avoid flowery filler like "magic", "memories are made", "elevate", or "nestled". ' +
        "For hashtags use only real ones the venue uses (e.g. #PelicanClubNOLA #FrenchQuarterDining #NewOrleansRestaurants #NOLAeats #craftcocktails #finedining) plus 1-2 specific to the photo; don't invent gimmicky tags. " +
        voice +
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
