import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { getClarifyingQuestions } from "@/lib/graphics/clarifying-questions";

export const runtime = "nodejs";
// Sonnet calls are fast, but give it 30 s to be safe.
export const maxDuration = 30;

// POST /api/graphics/questions
// Body: { prompt: string, format: "feed" | "story" }
// Response: { questions: Question[] }
//
// Does NOT touch the daily generation cap — this is a pre-generation step only.
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const { prompt, format } = body;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const resolvedFormat: "feed" | "story" = format === "story" ? "story" : "feed";

  try {
    const questions = await getClarifyingQuestions({
      prompt: prompt.trim(),
      format: resolvedFormat,
    });
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not fetch clarifying questions: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
