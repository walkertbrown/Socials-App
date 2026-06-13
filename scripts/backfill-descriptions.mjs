// One-time backfill: give every already-sorted photo an AI description + tags so
// intent search works on the existing library. Reads the thumbnail already stored
// in Supabase (no Drive re-download), runs one vision call each, writes description
// + tags. Does NOT touch category or move any files. Safe to re-run — it only
// fills photos whose description is still empty.
//
// Run: node --env-file=.env.local scripts/backfill-descriptions.mjs
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5";

const FEATURE_TAGS = [
  "staff", "food", "dessert", "cocktail", "wine", "dining room", "bar", "patio",
  "exterior", "event", "crowd", "live music", "holiday", "group", "portrait", "seafood",
];

const SYSTEM =
  "You describe a New Orleans restaurant's social-media photos for an internal search library. " +
  "Return ONLY a JSON object with keys: description, tags.\n" +
  "description = 1–2 short, plain sentences describing ONLY what is literally visible " +
  "(subjects, food/drink items, setting, lighting, day/night). Be concrete. " +
  "Do NOT guess people's names, event names, or specific menu-item names you can't be sure of.\n" +
  `tags = a JSON array of lowercase tags. Include any of these that apply: ${FEATURE_TAGS.join(", ")}. ` +
  "Then add up to 3 specific visible keywords (e.g. 'shrimp', 'oysters', 'manhattan'). Never invent a person's name.";

function parse(text) {
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s === -1 || e <= s) return null;
    const obj = JSON.parse(text.slice(s, e + 1));
    const description = typeof obj.description === "string" ? obj.description.trim() : "";
    let tags = Array.isArray(obj.tags)
      ? obj.tags.map((t) => String(t).toLowerCase().trim()).filter((t) => t && t.length < 40)
      : [];
    tags = Array.from(new Set(tags)).slice(0, 12);
    return { description, tags };
  } catch {
    return null;
  }
}

const { data: photos, error } = await sb
  .from("photos")
  .select("id, category, thumbnail_path, description")
  .eq("status", "ready")
  .neq("category", "videos");
if (error) { console.error(error.message); process.exit(1); }

const todo = photos.filter((p) => p.thumbnail_path && (!p.description || p.description.trim() === ""));
console.log(`${photos.length} photos; ${todo.length} need a description.`);

let done = 0, failed = 0;
for (const p of todo) {
  try {
    const { data: signed } = await sb.storage.from("thumbnails").createSignedUrl(p.thumbnail_path, 120);
    if (!signed?.signedUrl) throw new Error("no signed url");
    const img = Buffer.from(await (await fetch(signed.signedUrl)).arrayBuffer()).toString("base64");

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } },
          { type: "text", text: "Describe this photo. Return only the JSON object." },
        ],
      }],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
    const out = parse(text);
    if (!out) throw new Error("could not parse");

    const tags = out.tags.length ? out.tags : (p.category ? [p.category] : []);
    const { error: upErr } = await sb
      .from("photos")
      .update({ description: out.description, tags })
      .eq("id", p.id);
    if (upErr) throw new Error(upErr.message);

    done++;
    console.log(`✓ ${done}/${todo.length}  ${out.tags.join(", ")}  — ${out.description.slice(0, 60)}`);
  } catch (e) {
    failed++;
    console.warn(`✗ ${p.id}: ${e.message}`);
  }
}

console.log(`\nDone. Described ${done}, failed ${failed}.`);
