import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { suppressEmail } from "@/lib/db/outreach-suppression";

export const runtime = "nodejs";

// Resend webhook — hard bounces and spam complaints auto-suppress the address to
// protect the brand-new domain's reputation. Public (under the /api/webhooks
// allowlist); verifies the Svix signature when RESEND_WEBHOOK_SECRET is set.

function verifySvix(secret: string, id: string, ts: string, body: string, sigHeader: string): boolean {
  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
    // svix-signature is a space-separated list of "v1,<sig>" entries.
    return sigHeader.split(" ").some((part) => {
      const sig = part.split(",")[1];
      if (!sig || sig.length !== expected.length) return false;
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    });
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (secret) {
    const id = request.headers.get("svix-id") ?? "";
    const ts = request.headers.get("svix-timestamp") ?? "";
    const sig = request.headers.get("svix-signature") ?? "";
    if (!verifySvix(secret, id, ts, raw, sig)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  let event: { type?: string; data?: { to?: string | string[]; email?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const type = event.type ?? "";
  if (type === "email.bounced" || type === "email.complained") {
    const to = event.data?.to;
    const email = Array.isArray(to) ? to[0] : to ?? event.data?.email;
    if (email) {
      await suppressEmail(email, type === "email.complained" ? "complaint" : "bounce");
    }
  }

  return NextResponse.json({ ok: true });
}
