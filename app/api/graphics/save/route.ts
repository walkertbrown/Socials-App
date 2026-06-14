import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getPhotoUrlForGraphic } from "@/lib/graphics/pick-graphic-photo";
import { buildGraphicHtml } from "@/lib/graphics/render/html";
import { renderToPng } from "@/lib/graphics/render/adapter";
import { storeGraphicPng } from "@/lib/graphics/render/store-graphic";
import { createGraphic } from "@/lib/db/graphics";
import type { DesignSpec } from "@/lib/graphics/templates/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Explicit Save: renders the final spec, writes the PNG to the graphics bucket,
// creates a DB row, returns the graphic id and public URL.
//
// Cost guard: this is the ONLY route that writes to the bucket. Preview and
// Regenerate calls (/generate and /render) are transient — they never store.
//
// Body: { spec: DesignSpec }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const spec = body.spec as DesignSpec | undefined;
  if (!spec?.templateId) {
    return NextResponse.json({ error: "spec is required" }, { status: 400 });
  }

  // Resolve photo URL if this is a photo-background template.
  let photoUrl: string | null = null;
  if (spec.photoId) {
    photoUrl = await getPhotoUrlForGraphic(spec.photoId);
  }

  const appBaseUrl = getAppBaseUrl(request);
  const html = buildGraphicHtml({ spec, photoUrl, appBaseUrl });
  const { width, height } = sizePixels(spec.size);

  let pngBuffer: Buffer;
  try {
    pngBuffer = await renderToPng({ html, width, height });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // Generate a stable id upfront so the bucket path includes it.
  const { randomUUID } = await import("crypto");
  const graphicId = randomUUID();

  const { url, path } = await storeGraphicPng(pngBuffer, graphicId, spec.size);

  // Create the DB row. The id is pre-generated so the path is deterministic.
  const graphic = await createGraphic({
    design_spec: spec as unknown as Record<string, unknown>,
    png_path: path,
    size: spec.size,
  });

  return NextResponse.json({ graphicId: graphic.id, url });
}

function sizePixels(size: "feed" | "story"): { width: number; height: number } {
  return size === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
}

function getAppBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
