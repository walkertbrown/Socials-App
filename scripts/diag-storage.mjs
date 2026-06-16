// One-off diagnostic: what does the photos table actually look like post-migration?
// Read-only. Run: node --env-file=.env.local scripts/diag-storage.mjs
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function count(filterFn) {
  let q = sb.from("photos").select("*", { count: "exact", head: true });
  if (filterFn) q = filterFn(q);
  const { count, error } = await q;
  if (error) throw error;
  return count;
}

const total = await count();
const minio = await count((q) => q.eq("storage_backend", "minio"));
const drive = await count((q) => q.eq("storage_backend", "drive"));
const keyed = await count((q) => q.not("object_key", "is", null));
const nullKey = await count((q) => q.is("object_key", null));

console.log("=== photos table ===");
console.log("total rows         :", total);
console.log("storage=minio      :", minio);
console.log("storage=drive      :", drive);
console.log("object_key set     :", keyed);
console.log("object_key NULL    :", nullKey);

// What are the null-object_key rows?
const { data: nulls } = await sb
  .from("photos")
  .select("id, drive_name, category, status, storage_backend")
  .is("object_key", null)
  .limit(50);

console.log("\n=== rows still missing object_key (up to 50) ===");
const vids = nulls.filter((r) => /\.(mp4|mov|m4v|webm)$/i.test(r.drive_name || ""));
const others = nulls.filter((r) => !/\.(mp4|mov|m4v|webm)$/i.test(r.drive_name || ""));
console.log(`videos: ${vids.length}, non-video: ${others.length}`);
for (const r of others) {
  console.log(`  [non-video] "${r.drive_name}"  cat=${r.category}  status=${r.status}`);
}

// Status breakdown of the keyed (minio) rows — are they processed/ready?
const ready = await count((q) => q.eq("storage_backend", "minio").eq("status", "ready"));
const notReady = await count((q) =>
  q.eq("storage_backend", "minio").neq("status", "ready")
);
console.log("\n=== minio rows by readiness ===");
console.log("minio + ready      :", ready);
console.log("minio + NOT ready  :", notReady);

// A couple of sample minio keys to eyeball.
const { data: sample } = await sb
  .from("photos")
  .select("object_key, category, status, display_name")
  .eq("storage_backend", "minio")
  .limit(3);
console.log("\n=== sample minio rows ===");
for (const r of sample) console.log(" ", JSON.stringify(r));
