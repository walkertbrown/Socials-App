// Find the correct Browserless v2 screenshot body shape with the real key.
// Run: node --env-file=.env.local scripts/test-browserless.mjs
const key = process.env.BROWSERLESS_API_KEY;
const URL = `https://production-sfo.browserless.io/screenshot?token=${key}`;

const html = `<!doctype html><html><head>
<style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');</style>
</head><body style="margin:0">
<div style="width:300px;height:300px;background:#1c3149;color:#f3ecdd;
font-family:'Playfair Display',Georgia;display:flex;align-items:center;justify-content:center;font-size:26px">
Pelican Club</div></body></html>`;

const variants = {
  "gotoOptions networkidle0": {
    html,
    options: { type: "png", clip: { x: 0, y: 0, width: 300, height: 300 }, omitBackground: false },
    viewport: { width: 300, height: 300, deviceScaleFactor: 1 },
    gotoOptions: { waitUntil: "networkidle0", timeout: 15000 },
  },
  "waitForTimeout": {
    html,
    options: { type: "png", clip: { x: 0, y: 0, width: 300, height: 300 } },
    viewport: { width: 300, height: 300, deviceScaleFactor: 1 },
    waitForTimeout: 800,
  },
  "minimal no wait": {
    html,
    options: { type: "png", clip: { x: 0, y: 0, width: 300, height: 300 } },
    viewport: { width: 300, height: 300, deviceScaleFactor: 1 },
  },
};

for (const [name, body] of Object.entries(variants)) {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("image")) {
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`✓ "${name}"  →  PNG ${buf.length} bytes  ← WORKS`);
    } else {
      console.log(`✗ "${name}"  →  ${res.status}  ${(await res.text()).slice(0, 140)}`);
    }
  } catch (e) {
    console.log(`✗ "${name}"  →  ${e.message}`);
  }
}
