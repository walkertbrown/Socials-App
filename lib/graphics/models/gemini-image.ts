import "server-only";
import { GoogleGenAI } from "@google/genai";

// Nano Banana 2 — Gemini's fast image generation model.
// The @google/genai SDK (v2+) replaced the older @google/generative-ai package.
// Aspect ratio is set in config.responseFormat.image.aspectRatio.
const MODEL = "gemini-3.1-flash-image";

export async function generateGeminiImage(input: {
  prompt: string;
  format: "feed" | "story";
}): Promise<{ pngBase64: string }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is missing");

  const ai = new GoogleGenAI({ apiKey });

  // Map our format names to Gemini's aspect ratio values.
  const aspectRatio = input.format === "story" ? "9:16" : "1:1";

  // The SDK uses imageConfig (not responseFormat.image) for aspect ratio and size.
  // responseModalities must include "IMAGE" for the model to return image parts.
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: input.prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize: "2K",
      },
    },
  });

  // The response parts contain inlineData for generated image parts.
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return { pngBase64: part.inlineData.data };
    }
  }

  throw new Error("Gemini image generation returned no image data");
}
