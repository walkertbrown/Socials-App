import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getPhotosForMatching, type MatchablePhoto } from "@/lib/db/photos";
import { labelFor } from "@/lib/categories";

const MODEL = "claude-haiku-4-5";

// Words that carry no search signal — dropped before scoring.
const STOPWORDS = new Set([
  "a", "an", "the", "of", "for", "about", "to", "in", "on", "at", "our", "with",
  "and", "or", "that", "this", "some", "something", "want", "wanna", "make", "do",
  "i", "we", "post", "posts", "photo", "photos", "picture", "pictures", "pic", "pics",
  "show", "me", "from", "is", "it", "featuring", "feature", "kind", "new",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

// Score one photo against the intent. Tags are the strongest signal, then the
// category, then any description word overlap. Multi-word tags ("dining room")
// are matched against the raw intent string too.
function scorePhoto(photo: MatchablePhoto, intent: string, terms: string[]): number {
  let score = 0;
  const lcIntent = intent.toLowerCase();

  for (const tag of photo.tags ?? []) {
    const t = tag.toLowerCase();
    if (lcIntent.includes(t) || terms.includes(t)) score += 3;
    else if (terms.some((term) => t.includes(term) || term.includes(t))) score += 2;
  }

  if (photo.category) {
    const label = labelFor(photo.category).toLowerCase();
    if (terms.some((term) => label.includes(term) || photo.category === term)) score += 2;
  }

  if (photo.description) {
    const descTokens = new Set(tokenize(photo.description));
    for (const term of terms) if (descTokens.has(term)) score += 1;
  }

  return score;
}

// Returns photo ids that match the intent, best first. Empty intent -> [] (caller
// shows everything). Keyword scoring is free; only a genuinely fuzzy intent that
// scores nothing falls back to ONE text-only AI call (no images sent).
export async function matchPhotosToIntent(intent: string): Promise<string[]> {
  const trimmed = intent.trim();
  if (!trimmed) return [];

  const photos = await getPhotosForMatching();
  if (photos.length === 0) return [];

  const terms = tokenize(trimmed);
  const scored = photos
    .map((p) => ({ id: p.id, score: scorePhoto(p, trimmed, terms) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) return scored.map((s) => s.id);

  // Nothing matched on keywords — let the model reason over the stored text.
  return fuzzyMatch(trimmed, photos);
}

// Text-only fallback: hand the model the intent + a compact list of each photo's
// id/category/tags/description and ask which fit. No images = fractions of a cent.
async function fuzzyMatch(intent: string, photos: MatchablePhoto[]): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];
  const client = new Anthropic({ apiKey });

  const catalog = photos
    .map((p) => {
      const tags = (p.tags ?? []).join(", ");
      const desc = p.description ?? "";
      return `${p.id} | ${p.category ?? "?"} | ${tags} | ${desc}`;
    })
    .join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system:
      "You help pick restaurant social-media photos. Given a request and a catalog of photos " +
      "(format: id | category | tags | description), return ONLY a JSON array of the ids that best " +
      "fit the request, most relevant first, up to 12. If none fit, return []. No prose.",
    messages: [{ role: "user", content: `Request: ${intent}\n\nCatalog:\n${catalog}` }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join(" ");

  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end <= start) return [];
    const ids = JSON.parse(text.slice(start, end + 1));
    const valid = new Set(photos.map((p) => p.id));
    return (Array.isArray(ids) ? ids : []).map(String).filter((id) => valid.has(id));
  } catch {
    return [];
  }
}
