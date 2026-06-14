import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { WeekPayload } from "@/lib/report/compute-week";

// Two claude-sonnet-4-6 narrative calls per week — justified for prose quality.
// Cost guard: the cron checks narratives_generated_at before calling this;
// if already set, both calls are skipped entirely.
//
// Each call produces 2-3 sentences, no bullets.
// The prompt explicitly hedges when sample sizes are small.

const client = new Anthropic();

// Format the structured payload into a compact prompt context string.
// Keeps the prompt short to stay well within token budget.
function buildContext(payload: WeekPayload): string {
  const ig = payload.igSnapshot;
  const fb = payload.fbSnapshot;

  const lines: string[] = [
    `Week: ${payload.weekStart} to ${payload.weekEnd} (America/Chicago)`,
    `Goal: ${payload.goal}`,
    `IG posts this week: ${payload.posts.filter((p) => p.platform === "instagram").length}`,
    `FB posts this week: ${payload.posts.filter((p) => p.platform === "facebook").length}`,
    `Note: Stories not included in this report.`,
    ``,
    `IG account metrics:`,
    `  Reach: ${ig?.reach ?? "n/a"}`,
    `  Views: ${ig?.views ?? "n/a"}`,
    `  Net follower change: ${ig?.net_followers ?? "n/a"}`,
    `  Link taps: ${ig?.link_taps ?? "n/a"}`,
    ``,
    `FB page metrics:`,
    `  Unique reach: ${fb?.reach ?? "n/a"}`,
    `  Engagement: ${fb?.engagement ?? "n/a"}`,
    `  Followers count: ${fb?.followers_count ?? "n/a"}`,
    ``,
    `Format breakdown (IG + FB):`,
  ];

  for (const row of payload.formatBreakdown) {
    const reach = row.medianReach.ok
      ? `median reach ${Math.round(row.medianReach.value)}`
      : "not enough data yet";
    lines.push(
      `  ${row.format}: ${row.postCount} posts, ${reach}, ${row.totalLikes} likes, ${row.totalComments} comments`
    );
  }

  if (payload.topHashtags.length) {
    lines.push(``);
    lines.push(`Top hashtags by reach:`);
    for (const h of payload.topHashtags) {
      lines.push(`  ${h.tag}: median reach ${Math.round(h.medianReach)}, used ${h.useCount}x`);
    }
  }

  if (payload.trend.weekOverWeekChange.ok) {
    const wow = payload.trend.weekOverWeekChange.value;
    lines.push(``);
    lines.push(`Week-over-week follower change: ${wow.delta >= 0 ? "+" : ""}${wow.delta}`);
  }

  // Pass sample sizes so Claude can hedge appropriately.
  lines.push(``);
  lines.push(`Sample sizes: total posts with reach data = ${payload.posts.filter((p) => p.reach != null).length}`);
  lines.push(`Weeks of snapshot history: ${payload.trend.weeksAvailable}`);

  return lines.join("\n");
}

// Generate the "Win of the week" narrative — 2-3 sentences, celebratory tone,
// concrete and specific. Hedges explicitly when n is small.
export async function generateWinNarrative(payload: WeekPayload): Promise<string> {
  const context = buildContext(payload);
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `You are writing a weekly social media report for The Pelican Club, a restaurant. This section is "Win of the Week" — 2 to 3 sentences, positive and specific, no bullet points. If sample sizes are small (noted in the data), briefly hedge with "based on limited data." Do not mention what you cannot calculate. Do not use the phrase "the data shows" — just state the insight naturally.

Data:
${context}

Write the Win of the Week narrative now.`,
      },
    ],
  });

  const block = msg.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text.trim() : "Narrative unavailable.";
}

// Generate the "Recommended Focus" narrative — 2-3 sentences, forward-looking,
// actionable. Hedges when history is limited.
export async function generateRecommendNarrative(payload: WeekPayload): Promise<string> {
  const context = buildContext(payload);
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `You are writing a weekly social media report for The Pelican Club, a restaurant. This section is "Recommended Focus" for the coming week — 2 to 3 sentences, forward-looking, specific to what the data suggests. No bullet points. If there are fewer than 4 weeks of history, acknowledge that the recommendation will improve as more data accumulates. Do not make up data. Do not use the phrase "the data shows."

Data:
${context}

Write the Recommended Focus narrative now.`,
      },
    ],
  });

  const block = msg.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text.trim() : "Narrative unavailable.";
}
