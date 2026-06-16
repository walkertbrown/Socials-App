import "server-only";

// Renders page 1 of a PDF buffer to a PNG buffer at ~1800px wide.
// Uses pdf-to-img (pdfjs-dist wrapper, no native deps). Scale is chosen so
// that the output is approximately 1800px wide; sharp then upscales if needed.

import { pdf } from "pdf-to-img";
import sharp from "sharp";

export interface PdfRenderResult {
  png: Buffer;
  width: number;
  height: number;
}

// Target width for the full-res render (social-ready).
const FULL_RES_WIDTH = 1800;

// pdf-to-img's `scale` multiplies pdfjs's internal 72dpi rendering.
// A scale of 4 gives ~288dpi which is more than enough for 1800px on most
// letter/A4 menus. We'll let sharp resize to exactly FULL_RES_WIDTH after.
const RENDER_SCALE = 4;

export async function renderPdf(pdfBuffer: Buffer): Promise<PdfRenderResult> {
  const doc = await pdf(pdfBuffer, { scale: RENDER_SCALE });

  // Page numbers are 1-indexed in this library.
  const raw = await doc.getPage(1);
  await doc.destroy();

  // Resize to exactly FULL_RES_WIDTH wide, preserving aspect ratio.
  const resized = await sharp(raw)
    .resize({ width: FULL_RES_WIDTH, withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    png: resized.data,
    width: resized.info.width,
    height: resized.info.height,
  };
}

// Convenience: render at a reduced width for preview (saves bandwidth on the
// round-trip before the user has placed any cuts).
export async function renderPdfPreview(
  pdfBuffer: Buffer,
  previewWidth = 900
): Promise<PdfRenderResult> {
  const doc = await pdf(pdfBuffer, { scale: 2 });
  const raw = await doc.getPage(1);
  await doc.destroy();

  const resized = await sharp(raw)
    .resize({ width: previewWidth, withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });

  return {
    png: resized.data,
    width: resized.info.width,
    height: resized.info.height,
  };
}
