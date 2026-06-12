import "server-only";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const HASH_SIZE = 8; // 8x8 grayscale => a 64-bit average hash
const DUPLICATE_THRESHOLD = 8; // max differing bits to count as a near-duplicate

// Average hash (aHash): downscale to 8x8 grayscale, then mark each pixel
// 1/0 by whether it's above the image's mean. Robust to resas, crops of burst shots.
export async function computeHash(buffer: Buffer): Promise<string> {
  const data = await sharp(buffer)
    .grayscale()
    .resize(HASH_SIZE, HASH_SIZE, { fit: "fill" })
    .raw()
    .toBuffer();
  let sum = 0;
  for (const v of data) sum += v;
  const avg = sum / data.length;
  let bits = "";
  for (const v of data) bits += v >= avg ? "1" : "0";
  return bits;
}

function hamming(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// Returns the hash plus the duplicate group it belongs to: an existing group
// if a near-match is already stored, otherwise a fresh group id.
export async function hashAndGroup(
  buffer: Buffer
): Promise<{ hash: string; duplicateGroupId: string }> {
  const hash = await computeHash(buffer);
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("photos")
    .select("perceptual_hash, duplicate_group_id")
    .not("perceptual_hash", "is", null);

  for (const row of data ?? []) {
    if (
      row.perceptual_hash &&
      row.duplicate_group_id &&
      hamming(hash, row.perceptual_hash) <= DUPLICATE_THRESHOLD
    ) {
      return { hash, duplicateGroupId: row.duplicate_group_id as string };
    }
  }
  return { hash, duplicateGroupId: randomUUID() };
}
