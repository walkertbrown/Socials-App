import "server-only";
import crypto from "crypto";

// HMAC unsubscribe tokens — tie an email to a non-guessable token so the public
// unsubscribe endpoint can't be trivially used to suppress arbitrary addresses.

function secret(): string {
  return process.env.OUTREACH_UNSUB_SECRET ?? process.env.CRON_SECRET ?? "pelican-unsub-fallback";
}

export function makeUnsubToken(email: string): string {
  return crypto.createHmac("sha256", secret()).update(email.toLowerCase()).digest("hex").slice(0, 32);
}

export function verifyUnsubToken(email: string, token: string): boolean {
  const expected = makeUnsubToken(email);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
