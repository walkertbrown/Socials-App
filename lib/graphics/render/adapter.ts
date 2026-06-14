import "server-only";

// Renders an HTML string to a PNG buffer using Browserless.io's REST API
// (pay-as-you-go headless Chrome). No bundled Chromium, no Vercel function
// size issues, no @sparticuz/chromium.
//
// Fallback: if BROWSERLESS_API_KEY is absent, throws a clear error at render
// time — the app still compiles and everything else still works.

const BROWSERLESS_SCREENSHOT_URL =
  "https://chrome.browserless.io/screenshot";

export interface RenderOptions {
  html: string;
  width: number;
  height: number;
}

// Returns raw PNG bytes. Caller decides whether to stream inline (preview) or
// upload to the bucket (save). Throws on any render failure so the API route
// can return a proper error response.
export async function renderToPng(options: RenderOptions): Promise<Buffer> {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Rendering is not configured: BROWSERLESS_API_KEY is missing. " +
        "Add a free-tier key from browserless.io to enable graphic generation."
    );
  }

  const body = {
    html: options.html,
    options: {
      type: "png",
      // Exact canvas dimensions — no viewport scaling.
      clip: { x: 0, y: 0, width: options.width, height: options.height },
      omitBackground: false,
    },
    // Ensure Google Fonts are fetched before screenshotting.
    waitFor: 1000,
    viewport: {
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
    },
  };

  const res = await fetch(`${BROWSERLESS_SCREENSHOT_URL}?token=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // 30-second timeout — headless render is typically 2–5 s.
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Browserless render failed (${res.status}): ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
