// Read-only: dump the orphan rows (object_key IS NULL) so we can decide delete vs keep.
// The thing that gates deletion: is any of them "picked" (a keeper) or otherwise curated?
// Run: node --env-file=.env.local scripts/inspect-orphans.mjs
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from("photos")
  .select("id, drive_name, category, status, picked, tags, description, thumbnail_path, created_at")
  .is("object_key", null)
  .order("created_at", { ascending: true });

if (error) {
  console.error("[FAIL]", error.message);
  process.exit(1);
}

console.log(`${data.length} orphan rows (object_key IS NULL)\n`);
const pickedCount = data.filter((r) => r.picked).length;
const withTags = data.filter((r) => Array.isArray(r.tags) && r.tags.length).length;
const withDesc = data.filter((r) => r.description && r.description.trim()).length;
const withThumb = data.filter((r) => r.thumbnail_path).length;
console.log(`PICKED (keepers): ${pickedCount}`);
console.log(`have tags: ${withTags}   have description: ${withDesc}   have thumbnail: ${withThumb}`);
const first = data[0]?.created_at, last = data[data.length - 1]?.created_at;
console.log(`created_at range: ${first}  →  ${last}\n`);

for (const r of data) {
  const flag = r.picked ? "★PICKED" : "       ";
  const thumb = r.thumbnail_path ? "thumb" : "no-thumb";
  console.log(`${flag}  ${r.drive_name}`);
  console.log(`         cat=${r.category}  status=${r.status}  ${thumb}  created=${r.created_at?.slice(0, 10)}`);
}
