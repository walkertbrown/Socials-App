// Knock the white background out of the logo PNG -> transparent, so the circular
// medallion can sit on any color/photo background. Conservative threshold (only
// near-pure-white) so the cream text inside the badge is untouched.
// Usage: node scripts/process-logo.mjs <in.png> <out.png>
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) { console.error("usage: <in> <out>"); process.exit(1); }
await fs.mkdir(path.dirname(outPath), { recursive: true });

const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
let cleared = 0;
for (let i = 0; i < data.length; i += channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  // Near-pure white AND low color spread (so cream/gold/navy survive).
  if (r > 243 && g > 243 && b > 243 && Math.max(r, g, b) - Math.min(r, g, b) < 10) {
    data[i + 3] = 0;
    cleared++;
  }
}
await sharp(data, { raw: { width, height, channels } }).png().toFile(outPath);
console.log(`wrote ${outPath}  ${width}x${height}  (cleared ${cleared} white px)`);
