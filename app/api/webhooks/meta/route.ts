import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import crypto from "crypto";
import {
  upsertDmThread,
  insertDmMessageIfNew,
  hasOutboundMessages,
  isAutoReplied,
  stampAutoReplied,
} from "@/lib/db/dm-threads";
import { getActiveRules } from "@/lib/db/auto-reply-rules";
import { classifyDm } from "@/lib/process/classify-dm";
import { sendDmReply } from "@/lib/meta/messaging";

export const runtime = "nodejs";

// ── GET: Meta webhook verification challenge ─────────────────────────────────
// Meta hits this once when you subscribe. Echo hub.challenge if the verify
// token matches META_WEBHOOK_SECRET.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const secret = process.env.META_WEBHOOK_SECRET;

  if (mode === "subscribe" && secret && token === secret && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST: incoming webhook events ────────────────────────────────────────────
// Meta retries on non-200 — return 200 immediately, then do all work in after().
export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-hub-signature-256") ?? "";

  if (!verifyHmac(rawBody, sig, appSecret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  after(async () => {
    await processWebhookPayload(payload);
  });

  return new NextResponse("OK", { status: 200 });
}

// ── Core processing (runs in after(), non-blocking for Meta) ──────────────────

async function processWebhookPayload(payload: MetaWebhookPayload) {
  const platform: "instagram" | "facebook" =
    payload.object === "instagram" ? "instagram" : "facebook";

  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (event.message?.is_echo) continue;
      if (!event.message?.mid || !event.message.text) continue;

      const senderId = event.sender.id;
      const threadId = `${platform}:${senderId}`;
      const sentAt = new Date(event.timestamp).toISOString();
      const body = event.message.text;

      const threadDbId = await upsertDmThread({
        platform,
        thread_id: threadId,
        last_message_at: sentAt,
        last_message_preview: body.slice(0, 120),
      });

      await insertDmMessageIfNew({
        thread_id: threadDbId,
        platform_message_id: event.message.mid,
        direction: "inbound",
        body,
        sent_at: sentAt,
      });

      await maybeAutoReply({ platform, senderId, threadDbId, body });
    }
  }
}

async function maybeAutoReply(params: {
  platform: "instagram" | "facebook";
  senderId: string;
  threadDbId: string;
  body: string;
}) {
  const { platform, senderId, threadDbId, body } = params;

  // Skip if we've already auto-replied to this thread (idempotency).
  if (await isAutoReplied(threadDbId)) return;

  // Skip if this thread already has outbound messages — 24h window compliance.
  if (await hasOutboundMessages(threadDbId)) return;

  const rules = await getActiveRules();
  if (rules.length === 0) return;

  const ruleId = await classifyDm(body, rules);
  if (!ruleId) return;

  const rule = rules.find((r) => r.id === ruleId);
  if (!rule) return;

  let replyMid: string;
  try {
    replyMid = await sendDmReply(platform, senderId, rule.reply_text);
  } catch {
    // Log and bail — don't stamp auto_replied_at so it can be retried manually.
    console.error("auto-reply send failed", { threadDbId, ruleId });
    return;
  }

  await insertDmMessageIfNew({
    thread_id: threadDbId,
    platform_message_id: replyMid,
    direction: "outbound",
    body: rule.reply_text,
    sent_at: new Date().toISOString(),
    auto_reply_rule_id: ruleId,
  });

  await stampAutoReplied(threadDbId);
}

// ── HMAC verification ─────────────────────────────────────────────────────────

function verifyHmac(body: string, signature: string, secret: string): boolean {
  try {
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Meta webhook payload types ────────────────────────────────────────────────

type MetaWebhookPayload = {
  object: string;
  entry?: MetaEntry[];
};

type MetaEntry = {
  id: string;
  time: number;
  messaging?: MetaMessagingEvent[];
};

type MetaMessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
  };
};
