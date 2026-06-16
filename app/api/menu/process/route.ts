import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { renderPdf } from "@/lib/menu/render-pdf";
import { sliceToSquares } from "@/lib/menu/slice-image";

export const runtime = "nodejs";
export const maxDuration = 60;

// Accepts multipart form data:
//   file  — original PDF (max 10 MB)
//   cuts  — JSON string of sorted number[], e.g. "[33.5, 67.2]"
//
// Returns:
//   { fullPage: "<base64 PNG>", sections: ["<base64>", ...] }
//
// Nothing is written to any database or storage bucket.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }

  const cutsRaw = formData.get("cuts") as string | null;
  if (!cutsRaw) {
    return NextResponse.json({ error: "cuts is required" }, { status: 400 });
  }

  let cuts: number[];
  try {
    cuts = JSON.parse(cutsRaw);
    if (!Array.isArray(cuts) || cuts.some((c) => typeof c !== "number")) {
      throw new Error("cuts must be a JSON number array");
    }
  } catch {
    return NextResponse.json({ error: "cuts must be a valid JSON number array" }, { status: 400 });
  }

  // Sort ascending just in case the client didn't.
  cuts = [...cuts].sort((a, b) => a - b);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    const { png: fullPng } = await renderPdf(pdfBuffer);
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
