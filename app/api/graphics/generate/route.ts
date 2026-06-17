import { NextResponse, type NextRequest } from "next/server";
import { getUserOrNull } from "@/lib/auth/require-user";
import { enhancePrompt } from "@/lib/graphics/enhance-prompt";
import { generateGeminiImage } from "@/lib/graphics/models/gemini-image";
import { generateOpenAIImage } from "@/lib/graphics/models/openai-image";

export const runtime = "nodejs";
// Image generation can take 30–60 s per model; 120 s gives both parallel calls room.
export const maxDuration = 120;

// ── Daily cap backstop ────────────────────────────────────────────────────────
// In-memory counter keyed by UTC date. Resets automatically each new calendar
// day (module reloads on the next serverless cold start). Not distributed — one
// counter per server instance — which is acceptable for a single-user tool.
const DAILY_CAP = 25;
let capDate = "";
let capCount = 0;

function checkAndIncrementCap(): boolean {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  if (capDate !== today) {
    capDate = today;
    capCount = 0;
  }
  if (capCount >= DAILY_CAP) return false;
  capCount++;
  return true;
}

// ── Route handler ─────────────────────────────────────────────────────────────
// Body: { prompt: string, format: "feed"|"story", enhancedPrompt?: string }
//
// Cost guard: if the client sends back the enhancedPrompt from a prior call with
// the same text, we skip the Sonnet enhancement step.
//
// Both model calls run in parallel via Promise.allSettled so one failure does
// not kill the other.
//
// Response: { enhancedPrompt, results: [{ model, ok, pngBase64?, error? }] }
export async function POST(request: NextRequest) {
  const user = await getUserOrNull();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  if (!checkAndIncrementCap()) {
    return NextResponse.json(
      { error: `Daily generation limit of ${DAILY_CAP} reached. Try again tomorrow.` },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { prompt, format, enhancedPrompt: cachedEnhanced } = body;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const resolvedFormat: "feed" | "story" =
    format === "story" ? "story" : "feed";

  // Reuse the client-cached enhanced prompt when available to skip Sonnet.
  let enhancedPromptText: string;
  if (typeof cachedEnhanced === "string" && cachedEnhanced.trim()) {
    enhancedPromptText = cachedEnhanced.trim();
  } else {
    try {
      enhancedPromptText = await enhancePrompt({
        prompt: prompt.trim(),
        format: resolvedFormat,
      });
    } catch (e) {
      return NextResponse.json(
        { error: `Could not enhance prompt: ${(e as Error).message}` },
        { status: 500 }
      );
    }
  }

  // Call both models in parallel; let each fail independently.
  const [geminiResult, openaiResult] = await Promise.allSettled([
    generateGeminiImage({ prompt: enhancedPromptText, format: resolvedFormat }),
    generateOpenAIImage({ prompt: enhancedPromptText, format: resolvedFormat }),
  ]);

  const results = [
    geminiResult.status === "fulfilled"
      ? { model: "nano-banana-2", ok: true, pngBase64: geminiResult.value.pngBase64 }
      : { model: "nano-banana-2", ok: false, error: (geminiResult.reason as Error).message },
    openaiResult.status === "fulfilled"
      ? { model: "gpt-image-2", ok: true, pngBase64: openaiResult.value.pngBase64 }
      : { model: "gpt-image-2", ok: false, error: (openaiResult.reason as Error).message },
  ];

  return NextResponse.json({ enhancedPrompt: enhancedPromptText, results });
}
