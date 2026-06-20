// send-config.ts — outreach sender identity, CAN-SPAM footer content, and the
// live-send safety gate. From / address are baked in (they're not secrets) but
// env-overridable. Live sending stays OFF until BOTH OUTREACH_LIVE=1 and a
// Resend API key are present — so a deploy alone can never start emailing.

export const VENUE_NAME = "The Pelican Club";
export const VENUE_ADDRESS = "312 Exchange Pl, New Orleans, LA 70130";

export const OUTREACH_FROM =
  process.env.OUTREACH_FROM ?? `${VENUE_NAME} <hello@hello.pelicanclub.com>`;
export const OUTREACH_REPLY_TO =
  process.env.OUTREACH_REPLY_TO ?? "hello@hello.pelicanclub.com";

// Absolute base URL for unsubscribe links inside emails (NEXT_PUBLIC_APP_URL is
// set in env; the fallback only matters if it's missing).
export const APP_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "") || "https://app.pelicanclub.com";

// Live sending is double-gated: an explicit opt-in flag AND a configured key.
export function isLiveSending(): boolean {
  return process.env.OUTREACH_LIVE === "1" && !!process.env.RESEND_API_KEY;
}
