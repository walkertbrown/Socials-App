// Converts a DesignSpec + optional background photo URL into a full, self-contained
// HTML document that headless Chrome can render to a PNG.
//
// Design principles baked in:
//   - Every template gets the Pelican Club logo with a cream/white circular backing
//     chip so the navy medallion reads on any background color.
//   - Photo-background templates use a controlled gradient scrim (bottom→top) and
//     keep ALL text in the lower-third safe zone.
//   - Fonts load from Google Fonts via <link> — headless Chrome fetches them at
//     render. Self-hosting woff2 in public/brand/fonts/ is an easy upgrade later.
//   - Canvas = exactly 1080×1080 (feed) or 1080×1920 (story). No viewport scaling.

import type { DesignSpec } from "../templates/types";
import { getTemplate } from "../templates/registry";

export interface HtmlOptions {
  spec: DesignSpec;
  // Public URL of the background photo (already in Supabase Storage). Null for
  // solid/gradient templates.
  photoUrl: string | null;
  // Absolute base URL so the logo src resolves correctly in headless Chrome.
  appBaseUrl: string;
}

export function buildGraphicHtml(options: HtmlOptions): string {
  const { spec, photoUrl, appBaseUrl } = options;
  const template = getTemplate(spec.templateId);
  if (!template) throw new Error(`Unknown template id: ${spec.templateId}`);

  const palette = template.palettes.find((p) => p.id === spec.paletteId);
  if (!palette) throw new Error(`Unknown palette: ${spec.paletteId}`);

  const font = template.fonts.find((f) => f.id === spec.fontId);
  if (!font) throw new Error(`Unknown font: ${spec.fontId}`);

  const isStory = spec.size === "story";
  const w = 1080;
  const h = isStory ? 1920 : 1080;

  // Inject CSS custom properties from the selected palette.
  const cssVars = Object.entries(palette.vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n    ");

  // Logo: cream/white circular chip behind the navy medallion so it reads on any bg.
  // Chip is 22% of canvas width (prominent but not overbearing — roughly 237px on a
  // 1080 canvas). Logo sits inside at 72% of chip size. Top-center for solid/flexible
  // templates; top-left for photo-background (avoids competing with subjects).
  const chipSize = Math.round(w * 0.22);
  const logoSize = Math.round(chipSize * 0.72);
  const logoChipColor = palette.vars["--logo-chip"] ?? "#f3ecdd";
  const logoHtml = buildLogoChip(appBaseUrl, chipSize, logoSize, logoChipColor);

  // Build the main content block based on template id.
  const contentHtml = buildContent(spec, template.id, font, isStory, w);

  // Background: photo with scrim for photo templates, solid/gradient for others.
  // For the flexible template, the AI-generated background comes from the spec's
  // "background" slot — validated before it reaches the renderer.
  const bgCss = buildBackgroundCss(spec.templateId, photoUrl, palette, spec.slots);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${w}, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${font.googleFontsUrl}" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --display-font: ${font.displayFamily};
      --script-font: ${font.scriptFamily};
      --sans-font: ${font.sansFamily};
      ${cssVars}
    }

    html, body {
      width: ${w}px;
      height: ${h}px;
      overflow: hidden;
    }

    .canvas {
      position: relative;
      width: ${w}px;
      height: ${h}px;
      ${bgCss}
      font-family: var(--display-font);
    }

    /* ── Logo chip ─────────────────────────────────────────── */
    .logo-chip-wrap {
      position: absolute;
      top: ${Math.round(h * 0.045)}px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
    }
    .logo-chip-wrap.photo-bg {
      left: ${Math.round(w * 0.055)}px;
      transform: none;
    }

    /* ── Photo-background scrim ────────────────────────────── */
    .photo-scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        var(--scrim-end, rgba(15,28,45,0.88)) 0%,
        var(--scrim-start, rgba(0,0,0,0)) 55%
      );
      z-index: 1;
    }

    /* ── Safe zone: lower 40% for photo-bg, full-height for solid ─ */
    .content-wrap {
      position: absolute;
      z-index: 2;
      width: 100%;
      padding: ${Math.round(w * 0.055)}px;
    }
    .content-wrap.solid {
      top: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      /* Fix 1: offset center downward so text doesn't collide with the larger logo chip.
         Chip bottom is ~26.5% from top (4.5% offset + 22% chip), so we push the
         flex center down by ~12% of canvas height via padding-top vs padding-bottom. */
      padding-top: ${Math.round(h * 0.24)}px;
      padding-bottom: ${Math.round(h * 0.06)}px;
    }
    .content-wrap.photo {
      bottom: 0;
      padding-bottom: ${Math.round(h * 0.07)}px;
    }

    /* ── Typography scale ──────────────────────────────────── */
    .eyebrow, .category-label, .status-label, .event-type {
      font-family: var(--sans-font);
      font-size: ${Math.round(w * 0.022)}px;
      font-weight: 500;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent, #e6b94d);
      margin-bottom: ${Math.round(h * 0.018)}px;
    }
    .headline {
      font-family: var(--display-font);
      font-size: ${Math.round(w * 0.078)}px;
      font-weight: 700;
      line-height: 1.1;
      color: var(--headline, #f3ecdd);
      margin-bottom: ${Math.round(h * 0.018)}px;
    }
    .headline.story { font-size: ${Math.round(w * 0.088)}px; }
    .subhead {
      font-family: var(--display-font);
      font-size: ${Math.round(w * 0.036)}px;
      font-weight: 400;
      line-height: 1.5;
      color: var(--body, #e0d5c4);
      margin-bottom: ${Math.round(h * 0.02)}px;
      /* Fix 2: wrap long messages; never clip. max-width keeps lines readable. */
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: normal;
      max-width: 90%;
      overflow: visible;
    }
    .script-accent {
      font-family: var(--script-font);
      font-size: ${Math.round(w * 0.10)}px;
      color: var(--script, var(--accent, #e6b94d));
      line-height: 1.0;
      margin-bottom: ${Math.round(h * 0.012)}px;
      display: block;
    }
    .script-accent.large { font-size: ${Math.round(w * 0.13)}px; }
    .divider {
      width: ${Math.round(w * 0.12)}px;
      height: 1px;
      background: var(--divider, var(--accent, #e6b94d));
      margin: ${Math.round(h * 0.022)}px auto;
      opacity: 0.7;
    }
    .divider.left { margin-left: 0; }
    .date-time {
      font-family: var(--sans-font);
      font-size: ${Math.round(w * 0.032)}px;
      font-weight: 500;
      letter-spacing: 0.1em;
      color: var(--accent, #e6b94d);
      margin-bottom: ${Math.round(h * 0.01)}px;
    }
    .hours-display {
      font-family: var(--display-font);
      font-size: ${Math.round(w * 0.065)}px;
      font-weight: 700;
      color: var(--hours, var(--accent, #e6b94d));
      margin-bottom: ${Math.round(h * 0.015)}px;
    }
    .tagline, .cta {
      font-family: var(--sans-font);
      font-size: ${Math.round(w * 0.026)}px;
      font-weight: 400;
      letter-spacing: 0.08em;
      color: var(--body, #e0d5c4);
      opacity: 0.85;
    }
    .quote-mark {
      font-family: var(--script-font);
      font-size: ${Math.round(w * 0.18)}px;
      line-height: 0.6;
      color: var(--ornament, #e6b94d);
      opacity: 0.25;
      display: block;
      margin-bottom: -${Math.round(h * 0.02)}px;
    }
    .quote-text {
      font-family: var(--display-font);
      font-size: ${Math.round(w * 0.046)}px;
      font-style: italic;
      font-weight: 400;
      line-height: 1.5;
      color: var(--quote, #f3ecdd);
      margin-bottom: ${Math.round(h * 0.025)}px;
    }
    .attribution {
      font-family: var(--sans-font);
      font-size: ${Math.round(w * 0.024)}px;
      font-weight: 500;
      letter-spacing: 0.12em;
      color: var(--attribution, #e6b94d);
      margin-bottom: ${Math.round(h * 0.018)}px;
    }
    .grad-headline {
      font-family: var(--display-font);
      font-size: ${Math.round(w * 0.072)}px;
      font-weight: 700;
      line-height: 1.15;
      color: var(--headline, #f3ecdd);
      margin-bottom: ${Math.round(h * 0.02)}px;
    }
    .dish-name {
      font-family: var(--display-font);
      font-size: ${Math.round(w * 0.068)}px;
      font-weight: 700;
      line-height: 1.1;
      color: var(--headline, #e6b94d);
      margin-bottom: ${Math.round(h * 0.015)}px;
    }
    .dish-desc {
      font-family: var(--display-font);
      font-size: ${Math.round(w * 0.032)}px;
      font-weight: 400;
      font-style: italic;
      line-height: 1.45;
      color: var(--body, #e0d5c4);
      margin-bottom: ${Math.round(h * 0.015)}px;
    }
    .price {
      font-family: var(--sans-font);
      font-size: ${Math.round(w * 0.036)}px;
      font-weight: 500;
      color: var(--accent, #e6b94d);
      margin-bottom: ${Math.round(h * 0.015)}px;
    }
  </style>
</head>
<body>
  <div class="canvas">
    ${buildScrimHtml(spec.templateId)}
    <div class="logo-chip-wrap ${template.isPhotoBackground ? "photo-bg" : ""}">${logoHtml}</div>
    ${contentHtml}
  </div>
</body>
</html>`;
}

// ── Logo chip helper ─────────────────────────────────────────────────────────────

function buildLogoChip(
  appBaseUrl: string,
  chipSize: number,
  logoSize: number,
  chipColor: string
): string {
  const radius = chipSize / 2;
  const padding = (chipSize - logoSize) / 2;
  return `
    <div style="
      width: ${chipSize}px;
      height: ${chipSize}px;
      border-radius: 50%;
      background: ${chipColor};
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${padding}px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.18);
    ">
      <img
        src="${appBaseUrl}/brand/pelican-logo.png"
        width="${logoSize}"
        height="${logoSize}"
        style="display:block; object-fit: contain;"
        alt="Pelican Club"
      />
    </div>`;
}

// ── Background CSS ───────────────────────────────────────────────────────────────

function buildBackgroundCss(
  templateId: string,
  photoUrl: string | null,
  palette: { vars: Record<string, string> },
  // Slots are passed in so the flexible template can read its AI-generated background.
  slots?: Record<string, string>
): string {
  if (photoUrl) {
    // Photo background — scrim is handled by a separate overlay div.
    return `background-image: url('${photoUrl}'); background-size: cover; background-position: center;`;
  }
  if (templateId === "gradient-brand") {
    const angle = palette.vars["--grad-angle"] ?? "135deg";
    const a = palette.vars["--grad-a"] ?? "#1c3149";
    const b = palette.vars["--grad-b"] ?? "#0d1f30";
    return `background: linear-gradient(${angle}, ${a} 0%, ${b} 100%);`;
  }
  // Fix 3: flexible template uses the AI-generated background from its slot.
  // The value is pre-validated in design-spec.ts to only allow hex or linear-gradient.
  if (templateId === "flexible" && slots?.background) {
    return `background: ${slots.background}; background-size: cover;`;
  }
  const bg = palette.vars["--bg"] ?? "#1c3149";
  // If the palette's --bg is already a full CSS background value (gradient or
  // complex expression), use it directly rather than wrapping it in another gradient.
  // This supports the Pride rainbow palette and the flexible template's AI background.
  if (bg.startsWith("linear-gradient(") || bg.startsWith("radial-gradient(")) {
    return `background: ${bg};`;
  }
  const bg2 = palette.vars["--bg2"] ?? bg;
  return `background: linear-gradient(160deg, ${bg} 0%, ${bg2} 100%);`;
}

// ── Photo / flexible scrim overlay ──────────────────────────────────────────────

function buildScrimHtml(templateId: string): string {
  const scrimTemplates = [
    "announcement-photo",
    "event-photo",
    "holiday-photo",
    "menu-feature-photo",
    // Fix 3: flexible template always gets a scrim so cream text stays legible
    // over any AI-generated background (the scrim vars live in the palette).
    "flexible",
  ];
  if (!scrimTemplates.includes(templateId)) return "";
  return `<div class="photo-scrim"></div>`;
}

// ── Per-template content layouts ─────────────────────────────────────────────────

// buildContent produces the per-template HTML layout.
// w is the canvas width (always 1080) — passed in so fitFont can derive base px
// values that match the CSS class definitions above.
function buildContent(
  spec: DesignSpec,
  templateId: string,
  font: { displayFamily: string; scriptFamily: string; sansFamily: string },
  isStory: boolean,
  w: number
): string {
  const s = spec.slots;
  const storyClass = isStory ? " story" : "";
  const photoTemplates = [
    "announcement-photo",
    "event-photo",
    "holiday-photo",
    "menu-feature-photo",
  ];
  const isPhoto = photoTemplates.includes(templateId);
  const wrapClass = isPhoto ? "photo" : "solid";

  // Base px values that mirror the CSS class definitions. fitFont uses these as
  // its ceiling and scales down proportionally when the text exceeds comfyLen.
  const headlinePx   = isStory ? Math.round(w * 0.088) : Math.round(w * 0.078);
  const gradHeadPx   = isStory ? Math.round(w * 0.088) : Math.round(w * 0.072);
  const dishNamePx   = isStory ? Math.round(w * 0.088) : Math.round(w * 0.068);
  const scriptPx     = Math.round(w * 0.13); // .script-accent.large
  const subheadPx    = Math.round(w * 0.036);
  const quoteTextPx  = Math.round(w * 0.046);
  const dishDescPx   = Math.round(w * 0.032);
  const taglinePx    = Math.round(w * 0.026);
  const ctaPx        = Math.round(w * 0.026);
  const hoursPx      = Math.round(w * 0.065);
  const attributionPx = Math.round(w * 0.024);

  switch (templateId) {
    case "announcement-solid":
    case "announcement-photo":
      return `
        <div class="content-wrap ${wrapClass}">
          ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ""}
          <h1 class="headline${storyClass}" style="font-size:${fitFont(headlinePx, s.headline ?? "", 24)}px">${esc(s.headline ?? "")}</h1>
          ${s.subhead ? `<div class="divider ${isPhoto ? "left" : ""}"></div><p class="subhead" style="font-size:${fitFont(subheadPx, s.subhead, 70)}px">${esc(s.subhead)}</p>` : ""}
          ${s.tagline ? `<p class="tagline" style="font-size:${fitFont(taglinePx, s.tagline, 40)}px">${esc(s.tagline)}</p>` : ""}
        </div>`;

    case "event-solid":
    case "event-photo":
      return `
        <div class="content-wrap ${wrapClass}">
          ${s.eyebrow ? `<p class="event-type">${esc(s.eyebrow)}</p>` : ""}
          <h1 class="headline${storyClass}" style="font-size:${fitFont(headlinePx, s.headline ?? "", 24)}px">${esc(s.headline ?? "")}</h1>
          <div class="divider ${isPhoto ? "left" : ""}"></div>
          ${s.date ? `<p class="date-time">${esc(s.date)}${s.time ? ` &nbsp;·&nbsp; ${esc(s.time)}` : ""}</p>` : ""}
          ${s.detail ? `<p class="subhead" style="font-size:${fitFont(subheadPx, s.detail, 70)}px">${esc(s.detail)}</p>` : ""}
          ${s.cta ? `<p class="cta" style="margin-top:1.4em;font-size:${fitFont(ctaPx, s.cta, 40)}px">${esc(s.cta)}</p>` : ""}
        </div>`;

    case "holiday-solid":
    case "holiday-photo":
      return `
        <div class="content-wrap ${wrapClass}">
          <span class="script-accent large" style="font-size:${fitFont(scriptPx, s.occasion ?? "", 16)}px">${esc(s.occasion ?? "")}</span>
          <div class="divider"></div>
          ${s.message ? `<p class="subhead" style="font-size:${fitFont(subheadPx, s.message, 70)}px">${esc(s.message)}</p>` : ""}
          ${s.tagline ? `<p class="tagline" style="font-size:${fitFont(taglinePx, s.tagline, 40)}px">${esc(s.tagline)}</p>` : ""}
        </div>`;

    case "quote-feature":
      return `
        <div class="content-wrap solid">
          <span class="quote-mark">"</span>
          <p class="quote-text" style="font-size:${fitFont(quoteTextPx, s.quote ?? "", 90)}px">${esc(s.quote ?? "")}</p>
          ${s.attribution ? `<p class="attribution" style="font-size:${fitFont(attributionPx, s.attribution, 40)}px">${esc(s.attribution)}</p>` : ""}
          <div class="divider"></div>
          ${s.tagline ? `<p class="tagline" style="font-size:${fitFont(taglinePx, s.tagline, 40)}px">${esc(s.tagline)}</p>` : ""}
        </div>`;

    case "hours-card":
      return `
        <div class="content-wrap solid">
          <p class="status-label">${esc(s.status ?? "")}</p>
          <p class="hours-display" style="font-size:${fitFont(hoursPx, s.hours ?? "", 20)}px">${esc(s.hours ?? "")}</p>
          ${s.note ? `<div class="divider"></div><p class="subhead" style="font-size:${fitFont(subheadPx, s.note, 70)}px">${esc(s.note)}</p>` : ""}
          ${s.tagline ? `<p class="tagline" style="margin-top:1.2em;font-size:${fitFont(taglinePx, s.tagline, 40)}px">${esc(s.tagline)}</p>` : ""}
        </div>`;

    case "menu-feature-solid":
    case "menu-feature-photo":
      return `
        <div class="content-wrap ${wrapClass}">
          ${s.category ? `<p class="category-label">${esc(s.category)}</p>` : ""}
          <h1 class="dish-name${storyClass}" style="font-size:${fitFont(dishNamePx, s.dish ?? "", 24)}px">${esc(s.dish ?? "")}</h1>
          ${s.description ? `<p class="dish-desc" style="font-size:${fitFont(dishDescPx, s.description, 70)}px">${esc(s.description)}</p>` : ""}
          ${s.price ? `<p class="price">${esc(s.price)}</p>` : ""}
          ${s.cta ? `<div class="divider ${isPhoto ? "left" : ""}"></div><p class="cta" style="font-size:${fitFont(ctaPx, s.cta, 40)}px">${esc(s.cta)}</p>` : ""}
        </div>`;

    case "gradient-brand":
      return `
        <div class="content-wrap solid">
          <h1 class="grad-headline${storyClass}" style="font-size:${fitFont(gradHeadPx, s.headline ?? "", 24)}px">${esc(s.headline ?? "")}</h1>
          ${s.subhead ? `<div class="divider"></div><p class="subhead" style="font-size:${fitFont(subheadPx, s.subhead, 70)}px">${esc(s.subhead)}</p>` : ""}
          ${s.tagline ? `<p class="tagline" style="margin-top:1.4em;font-size:${fitFont(taglinePx, s.tagline, 40)}px">${esc(s.tagline)}</p>` : ""}
        </div>`;

    // Flexible / generative template — centered layout with generous spacing;
    // scrim ensures cream text is always readable over the AI-generated background.
    case "flexible":
      return `
        <div class="content-wrap solid" style="text-shadow: 0 1px 8px rgba(0,0,0,0.45);">
          <span class="script-accent large" style="font-size:${fitFont(scriptPx, s.occasion ?? "", 16)}px">${esc(s.occasion ?? "")}</span>
          <div class="divider"></div>
          ${s.message ? `<p class="subhead" style="max-width:80%;font-size:${fitFont(subheadPx, s.message, 70)}px">${esc(s.message)}</p>` : ""}
          ${s.tagline ? `<p class="tagline" style="margin-top:1.4em;font-size:${fitFont(taglinePx, s.tagline, 40)}px">${esc(s.tagline)}</p>` : ""}
        </div>`;

    default:
      return `<div class="content-wrap solid"><h1 class="headline">${esc(String(spec.templateId))}</h1></div>`;
  }
}

// HTML-escape to prevent slot content from injecting markup.
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Auto-shrink helper: returns a font-size in px that keeps long copy from
// clipping. At or below comfyLen characters the base size is returned unchanged
// so normal-length copy looks exactly as the designer intended. Beyond that the
// size falls with sqrt(comfyLen/len) — a gentle curve — down to a floor of
// basePx * minScale. Using sqrt instead of linear gives a graceful taper:
// a 300-char message that would normally render at 38px scales to ~17px which
// remains legible inside the 1080px canvas.
function fitFont(basePx: number, text: string, comfyLen: number, minScale = 0.45): number {
  const len = text.length;
  if (len <= comfyLen) return basePx;
  const scale = Math.max(minScale, Math.sqrt(comfyLen / len));
  return Math.round(basePx * scale);
}
