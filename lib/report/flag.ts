// Rule-based "Flag of the Week" insight — no Claude call, no opinion, no criticism.
// Framed as a factual observation Elizabeth can act on.
//
// Checks (in priority order):
//   1. Steep reach drop (>30% below prior week median) — may signal algorithm change.
//   2. Zero engagement on 3+ posts — flag for caption review.
//   3. Net follower loss.
//   4. No posts in the week — flag that she's gone dark.

import type { PostInsightsRow } from "@/lib/db/post-insights";
import type { AccountSnapshot } from "@/lib/db/weekly-snapshots";

export interface FlagResult {
  // null = nothing to flag (good week).
  text: string | null;
}

export function computeFlag(
  posts: PostInsightsRow[],
  igSnapshot: AccountSnapshot | null,
  priorIgSnapshot: AccountSnapshot | null
): FlagResult {
  // Flag: no posts at all this week.
  if (posts.length === 0) {
    return { text: "No posts were recorded for this week — the account may have gone dark." };
  }

  // Flag: net follower loss.
  const netGrowth = igSnapshot?.net_followers ?? null;
  if (netGrowth != null && netGrowth < 0) {
    return {
      text: `Net follower change this week was ${netGrowth} — the account lost more followers than it gained.`,
    };
  }

  // Flag: steep reach drop vs prior week (>30%).
  const currentReach = igSnapshot?.reach ?? null;
  const priorReach = priorIgSnapshot?.reach ?? null;
  if (currentReach != null && priorReach != null && priorReach > 0) {
    const dropPercent = ((priorReach - currentReach) / priorReach) * 100;
    if (dropPercent > 30) {
      return {
        text: `Account reach dropped ${Math.round(dropPercent)}% from the prior week (${priorReach.toLocaleString()} → ${currentReach.toLocaleString()}). May reflect algorithm shift or reduced posting.`,
      };
    }
  }

  // Flag: multiple posts with zero engagement.
  const zeroEngagementPosts = posts.filter(
    (p) =>
      (p.reach ?? 0) > 0 &&
      (p.likes ?? 0) === 0 &&
      (p.comments ?? 0) === 0
  );
  if (zeroEngagementPosts.length >= 3) {
    return {
      text: `${zeroEngagementPosts.length} posts this week had zero likes and comments despite reaching an audience. Caption or image variety may be worth reviewing.`,
    };
  }

  return { text: null };
}
