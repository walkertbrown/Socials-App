import "server-only";
// send-email.ts — Resend transport (via fetch, no SDK). Each send carries an
// Idempotency-Key = the draft id, so a retry or a double cron-fire can never
// send the same email twice. sendDraftBatch fans out with limited concurrency
// so a 500-email batch finishes well inside the function time limit.

import { OUTREACH_FROM, OUTREACH_REPLY_TO, APP_URL } from "@/lib/outreach/send-config";
import { buildEmailHtml, unsubscribeUrl } from "@/lib/outreach/email-html";
import { makeUnsubToken } from "@/lib/outreach/unsub-token";

export interface SendableDraft {
  id: string;
  email: string;
  subject: string;
  body: string;
}

interface SendInput {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  unsubUrl: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: OUTREACH_FROM,
        to: [input.to],
        reply_to: OUTREACH_REPLY_TO,
        subject: input.subject,
        html: input.html,
        headers: {
          "List-Unsubscribe": `<${input.unsubUrl}>, <mailto:${OUTREACH_REPLY_TO}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Run fn over items with at most `limit` in flight at once.
async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Send a batch of drafts. Returns the ids that succeeded vs. failed so the
// caller can stamp send_status accordingly.
export async function sendDraftBatch(drafts: SendableDraft[]): Promise<{ sentIds: string[]; failedIds: string[] }> {
  const results = await mapPool(drafts, 8, async (d) => {
    const url = unsubscribeUrl(APP_URL, d.email, makeUnsubToken(d.email));
    const html = buildEmailHtml(d.body, url);
    const r = await sendEmail({ to: d.email, subject: d.subject, html, idempotencyKey: d.id, unsubUrl: url });
    return { id: d.id, ok: r.ok };
  });
  return {
    sentIds: results.filter((r) => r.ok).map((r) => r.id),
    failedIds: results.filter((r) => !r.ok).map((r) => r.id),
  };
}
