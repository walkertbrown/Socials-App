import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { buildDesignSpec } from "@/lib/graphics/design-spec";
import { getTextSafePhotoIds, getPhotoUrlForGraphic } from "@/lib/graphics/pick-graphic-photo";
import { buildGraphicHtml } from "@/lib/graphics/render/html";
import { renderToPng } from "@/lib/graphics/render/adapter";

export const runtime = "nodejs";
// Allow up to 45 s — Browserless render is typically 2–5 s but font fetches
// can add a few seconds.
export const maxDuration = 45;

// Prompt → AI spec → render → return PNG inline as base64 + the spec.
// NOTHING is written to the bucket here (preview/generate are transient).
// Cost guard: debounce is enforced client-side (button disabled until response);
// the spec is returned so the client can tweak and call /api/graphics/render.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const { prompt, styleHint, size } = body;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const resolvedSize: "feed" | "story" =
    size === "story" ? "story" : "feed";

  // Get text-safe photo ids for the AI to choose from.
  const availablePhotoIds = await getTextSafePhotoIds();

  let spec;
  try {
    spec = await buildDesignSpec({
      prompt: prompt.trim(),
      styleHint: typeof styleHint === "string" ? styleHint.trim() : "",
      size: resolvedSize,
      availablePhotoIds,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not generate design spec: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  // Resolve photo URL if the template needs one.
  let photoUrl: string | null = null;
  if (spec.photoId) {
    photoUrl = await getPhotoUrlForGraphic(spec.photoId);
  }

  // Determine the app base URL for the logo <img src>.
  const appBaseUrl = getAppBaseUrl(request);

  const html = buildGraphicHtml({ spec, photoUrl, appBaseUrl });
  const { width, height } = sizePixels(resolvedSize);

  let pngBuffer: Buffer;
  try {
    pngBuffer = await renderToPng({ html, width, height });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }

  // Return PNG as base64 so the client can show a <img src="data:image/png;base64,...">
  // preview without any storage write.
  const pngBase64 = pngBuffer.toString("base64");
  return NextResponse.json({ pngBase64, spec });
}

function sizePixels(size: "feed" | "story"): { width: number; height: number } {
  return size === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
}

function getAppBaseUrl(req: NextRequest): string {
  // Prefer the vercel deployment URL; fall back to origin from the request.
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
