// Delete the stale orphan rows (object_key IS NULL). These point at files that
// aren't in MinIO. Confirmed: 0 picked, all from the 2026-06-13 test batch.
// Prints exactly what it removes. Safety: aborts if the count is unexpectedly large.
// Run: node --env-file=.env.local scripts/delete-orphans.mjs
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: rows, error } = await sb
  .from("photos")
  .select("id, drive_name, picked")
  .is("object_key", null);

if (error) {
  console.error("[FAIL] fetch:", error.message);
  process.exit(1);
}

console.log(`Found ${rows.length} orphan rows (object_key IS NULL).`);
const picked = rows.filter((r) => r.picked);
if (picked.length > 0) {
  console.error(`[ABORT] ${picked.length} of these are PICKED keepers — not deleting. Review first.`);
  process.exit(1);
}
if (rows.length > 40) {
  console.error(`[ABORT] ${rows.length} is more than expected (~24). Not deleting — check state first.`);
  process.exit(1);
}

let ok = 0;
let failed = 0;
for (const r of rows) {
  const { error: delErr } = await sb.from("photos").delete().eq("id", r.id);
  if (delErr) {
    console.error(`[FAIL] ${r.drive_name}: ${delErr.message}`);
    failed++;
  } else {
    console.log(`[deleted] ${r.drive_name}`);
    ok++;
  }
}

console.log(`\nDone. Deleted ${ok}, failed ${failed}.`);

const { count } = await sb
  .from("photos")
  .select("*", { count: "exact", head: true })
  .is("object_key", null);
console.log(`Remaining orphan rows now: ${count}`);
