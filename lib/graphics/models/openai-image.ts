import "server-only";
import OpenAI from "openai";

// GPT Image 2 via OpenAI.
// gpt-image-2 returns base64 in data[0].b64_json.
// Sizes: feed→1024x1024 (square), story→1024x1536 (portrait, closest to 9:16).
const MODEL = "gpt-image-2";

export async function generateOpenAIImage(input: {
  prompt: string;
  format: "feed" | "story";
}): Promise<{ pngBase64: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const client = new OpenAI({ apiKey });

  const size = input.format === "story" ? "1024x1536" : "1024x1024";

  // gpt-image-2 ALWAYS returns base64 in b64_json — it does not accept a
  // response_format param (that was a DALL-E 3 option and 400s here).
  const result = await client.images.generate({
    model: MODEL,
    prompt: input.prompt,
    size,
    quality: "medium",
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image generation returned no image data");
  }

  return { pngBase64: b64 };
}
