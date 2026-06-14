import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getPhotoUrlForGraphic } from "@/lib/graphics/pick-graphic-photo";
import { buildGraphicHtml } from "@/lib/graphics/render/html";
import { renderToPng } from "@/lib/graphics/render/adapter";
import type { DesignSpec } from "@/lib/graphics/templates/types";

export const runtime = "nodejs";
export const maxDuration = 45;

// In-flight guard: only one render at a time per server instance.
// The client also disables the button until the response returns (debounce),
// but this guard catches any race at the server level.
let renderInFlight = false;

// Re-render a tweaked DesignSpec and return the PNG as base64.
// Nothing is written to the bucket — this is preview/tweak only.
// Body: { spec: DesignSpec }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  if (renderInFlight) {
    return NextResponse.json(
      { error: "A render is already in progress. Please wait." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const spec = body.spec as DesignSpec | undefined;
  if (!spec?.templateId) {
    return NextResponse.json({ error: "spec is required" }, { status: 400 });
  }

  renderInFlight = true;
  try {
    // Resolve photo URL if the template needs one.
    let photoUrl: string | null = null;
    if (spec.photoId) {
      photoUrl = await getPhotoUrlForGraphic(spec.photoId);
    }

    const appBaseUrl = getAppBaseUrl(request);
    const html = buildGraphicHtml({ spec, photoUrl, appBaseUrl });
    const { width, height } = sizePixels(spec.size);
    const pngBuffer = await renderToPng({ html, width, height });

    return NextResponse.json({ pngBase64: pngBuffer.toString("base64") });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    renderInFlight = false;
  }
}

function sizePixels(size: "feed" | "story"): { width: number; height: number } {
  return size === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
}

function getAppBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
