import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Preview rendering is now handled client-side via pdfjs-dist.
// This endpoint is no longer called.
export async function POST() {
  return NextResponse.json({ error: "Not used" }, { status: 410 });
}
