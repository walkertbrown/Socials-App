import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { storeGraphicPng } from "@/lib/graphics/render/store-graphic";
import { createGraphic } from "@/lib/db/graphics";

export const runtime = "nodejs";
export const maxDuration = 30;

// Explicit Save: receives the final composited PNG from the browser canvas,
// uploads it to the graphics bucket, creates a DB row, and returns the id + URL.
//
// Cost guard: this is the ONLY route that writes to the bucket. The generate
// route is transient — it never stores anything.
//
// Body: { pngBase64: string, format: "feed"|"story", model: string, enhancedPrompt: string }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const { pngBase64, format, model, enhancedPrompt } = body;

  if (typeof pngBase64 !== "string" || !pngBase64) {
    return NextResponse.json({ error: "pngBase64 is required" }, { status: 400 });
  }

  const resolvedFormat: "feed" | "story" = format === "story" ? "story" : "feed";

  // Decode base64 to a Buffer for storage upload.
  const pngBuffer = Buffer.from(pngBase64, "base64");

  const { randomUUID } = await import("crypto");
  const graphicId = randomUUID();

  let storageResult: { url: string; path: string };
  try {
    storageResult = await storeGraphicPng(pngBuffer, graphicId, resolvedFormat);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // The graphics table has a NOT NULL design_spec column that is vestigial for
  // image-gen graphics. Write a provenance marker so the row is self-documenting.
  const provenanceSpec: Record<string, unknown> = {
    source: "image-gen",
    model: typeof model === "string" ? model : "unknown",
    enhancedPrompt: typeof enhancedPrompt === "string" ? enhancedPrompt : "",
  };

  let graphic;
  try {
    graphic = await createGraphic({
      design_spec: provenanceSpec,
      png_path: storageResult.path,
      size: resolvedFormat,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ graphicId: graphic.id, url: storageResult.url });
}
