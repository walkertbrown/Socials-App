// Public unsubscribe confirmation page (no auth — recipients aren't logged in).
// The actual suppression happens in /api/unsubscribe, which redirects here.

import { VENUE_NAME } from "@/lib/outreach/send-config";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ok = status !== "bad";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", padding: 24, fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center", color: "#1a1a1a" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 12px" }}>
          {ok ? "You're unsubscribed" : "Link expired"}
        </h1>
        <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6, margin: 0 }}>
          {ok
            ? `You won't receive any more emails from ${VENUE_NAME}. We're sorry to see you go.`
            : "We couldn't verify that unsubscribe link. Please reply to the email and we'll remove you right away."}
        </p>
      </div>
    </div>
  );
}
