// Reconcile the counts: how many processed, moved, deduped, by category.
// Run: node --env-file=.env.local scripts/reconcile.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: all, error } = await sb
  .from("photos")
  .select("id, category, current_folder_id, duplicate_group_id, status, thumbnail_path");
if (error) { console.error(error.message); process.exit(1); }

const ready = all.filter((p) => p.status === "ready");
console.log("Total rows:", all.length, "| ready:", ready.length, "| still processing:", all.length - ready.length);

const byCat = {};
for (const p of ready) byCat[p.category || "(none)"] = (byCat[p.category || "(none)"] || 0) + 1;
console.log("By category:", JSON.stringify(byCat));

const notMoved = ready.filter((p) => !p.current_folder_id);
console.log("Moved into a folder:", ready.length - notMoved.length, "| NOT moved:", notMoved.length);

const groups = new Set(ready.map((p) => p.duplicate_group_id || p.id));
console.log("Tiles shown on board after dedup:", groups.size, "| near-duplicates collapsed:", ready.length - groups.size);
