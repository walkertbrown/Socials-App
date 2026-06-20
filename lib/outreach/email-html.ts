// email-html.ts — wrap a plain-text email body in minimal, deliverability-safe
// HTML with the legally required CAN-SPAM footer: sender name, physical mailing
// address, and a one-click unsubscribe link. No images, no tracking pixels.

import { VENUE_NAME, VENUE_ADDRESS } from "@/lib/outreach/send-config";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Build the absolute unsubscribe URL used in both the footer link and the
// List-Unsubscribe header.
export function unsubscribeUrl(appUrl: string, email: string, token: string): string {
  return `${appUrl}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`;
}

export function buildEmailHtml(bodyText: string, unsubUrl: string): string {
  const paragraphs = bodyText
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#ffffff;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;">
<div style="max-width:560px;margin:0 auto;padding:28px 24px;">
${paragraphs}
<hr style="border:none;border-top:1px solid #e2e2e2;margin:26px 0 14px;">
<p style="margin:0;color:#8a8a8a;font-size:12px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
${escapeHtml(VENUE_NAME)} &middot; ${escapeHtml(VENUE_ADDRESS)}<br>
You're receiving this because you visited us and opted in to hear from us.
<a href="${unsubUrl}" style="color:#8a8a8a;text-decoration:underline;">Unsubscribe</a>.
</p>
</div></body></html>`;
}
