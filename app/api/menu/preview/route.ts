import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { renderPdfPreview } from "@/lib/menu/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

// Accepts a PDF upload (multipart, field "file", max 10 MB) and returns a
// base64-encoded 900px-wide preview PNG. Used only for the interactive cut-line
// editor — not stored anywhere.
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

  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    const { png } = await renderPdfPreview(pdfBuffer, 900);
    return NextResponse.json({ preview: png.toString("base64") });
  } catch (e) {
    console.error("[menu/preview]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
