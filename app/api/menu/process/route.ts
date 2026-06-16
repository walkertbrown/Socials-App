import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { sliceToSquares } from "@/lib/menu/slice-image";

export const runtime = "nodejs";
export const maxDuration = 60;

// Accepts multipart form data:
//   image — full-resolution PNG rendered by the client (max 20 MB)
//   cuts  — JSON string of sorted number[], e.g. "[33.5, 67.2]"
//
// The client renders the PDF to a canvas and sends the PNG — no server-side
// PDF rendering needed. The server only slices and pads to squares.
//
// Returns: { fullPage: "<base64 PNG>", sections: ["<base64>", ...] }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const image = formData.get("image") as File | null;
  if (!image) {
    return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
  }

  const MAX_BYTES = 20 * 1024 * 1024;
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 20 MB)" }, { status: 413 });
  }

  const cutsRaw = formData.get("cuts") as string | null;
  if (!cutsRaw) {
    return NextResponse.json({ error: "cuts is required" }, { status: 400 });
  }

  let cuts: number[];
  try {
    cuts = JSON.parse(cutsRaw);
    if (!Array.isArray(cuts) || cuts.some((c) => typeof c !== "number")) {
      throw new Error();
    }
  } catch {
    return NextResponse.json({ error: "cuts must be a valid JSON number array" }, { status: 400 });
  }

  cuts = [...cuts].sort((a, b) => a - b);

  try {
    const fullPng = Buffer.from(await image.arrayBuffer());
    const sectionPngs = await sliceToSquares(fullPng, cuts);

    return NextResponse.json({
      fullPage: fullPng.toString("base64"),
      sections: sectionPngs.map((b) => b.toString("base64")),
    });
  } catch (e) {
    console.error("[menu/process]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
