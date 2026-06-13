// Generate simple PWA/notification icons. Run once: node scripts/gen-icons.mjs
import sharp from "sharp";
import fs from "fs/promises";

function svg(size) {
  const fs2 = Math.round(size * 0.42);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#0f3d3e"/>
       <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
         font-family="Georgia, serif" font-size="${fs2}" fill="#f5efe6">PC</text>
     </svg>`
  );
}

await fs.mkdir("public", { recursive: true });
for (const size of [192, 512]) {
  await sharp(svg(size)).png().toFile(`public/icon-${size}.png`);
  console.log(`wrote public/icon-${size}.png`);
}
