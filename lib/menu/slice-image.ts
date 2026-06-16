import "server-only";

// Slices a PNG buffer into sections at given Y-percent positions, then pads
// each section to a 1:1 square (Instagram format) using sharp.
//
// Square padding: white background, section width × section width canvas,
// section content centered vertically.

import sharp from "sharp";

// cutPercents: sorted array of Y positions as % of total image height (0–100).
// The image is cut at each position, producing (cutPercents.length + 1) sections.
export async function sliceToSquares(
  pngBuffer: Buffer,
  cutPercents: number[]
): Promise<Buffer[]> {
  const meta = await sharp(pngBuffer).metadata();
  const imgWidth = meta.width!;
  const imgHeight = meta.height!;

  // Build cut positions in pixels (always include top/bottom boundaries).
  const yPositions = [
    0,
    ...cutPercents.map((p) => Math.round((p / 100) * imgHeight)),
    imgHeight,
  ];

  const sections: Buffer[] = [];

  for (let i = 0; i < yPositions.length - 1; i++) {
    const top = yPositions[i];
    const bottom = yPositions[i + 1];
    const sectionHeight = bottom - top;

    if (sectionHeight <= 0) continue;

    // Extract the section strip.
    const strip = await sharp(pngBuffer)
      .extract({ left: 0, top, width: imgWidth, height: sectionHeight })
      .png()
      .toBuffer();

    // Pad to square: canvas is imgWidth × imgWidth, content centered vertically.
    // If the section is taller than wide, shrink it to fit first — composite
    // requires the input to be no larger than the canvas.
    const canvasSize = imgWidth;

    let input = strip;
    let inputHeight = sectionHeight;
    if (sectionHeight > canvasSize) {
      input = await sharp(strip)
        .resize({ width: canvasSize, height: canvasSize, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer();
      inputHeight = canvasSize;
    }

    const topPad = Math.floor((canvasSize - inputHeight) / 2);

    const squared = await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input, top: topPad, left: 0 }])
      .png()
      .toBuffer();

    sections.push(squared);
  }

  return sections;
}
