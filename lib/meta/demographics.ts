import "server-only";
import { graph } from "@/lib/meta/client";

// IG follower_demographics returns data under this confirmed shape (probed live):
//   data[0].total_value.breakdowns[0].results[] = { dimension_values: [...], value: n }
//
// The metric is lifetime (not windowed) — we fetch once per week as a snapshot.
// FB demographics are unavailable (API restriction) — audience snapshot is IG-ONLY.

// Each breakdown dimension we request.
const DEMO_BREAKDOWNS = ["age", "gender", "city"] as const;

export interface DemographicsSnapshot {
  // Top 3 cities by follower count.
  topCities: Array<{ city: string; count: number }>;
  // Age bucket breakdown — e.g. "25-34" → count.
  ageBreakdown: Record<string, number>;
  // Gender split — e.g. "M" → count, "F" → count.
  genderSplit: Record<string, number>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBreakdown(data: any[]): Array<{ dimension_values: string[]; value: number }> {
  // Navigate: data[0].total_value.breakdowns[0].results
  try {
    return data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  } catch {
    return [];
  }
}

// Fetch IG follower demographics (lifetime, not windowed).
// Never throws — returns empty on error.
// ig_user_id — the numeric IG user ID stored in meta_credentials.
export async function fetchIgDemographics(
  igUserId: string,
  token: string
): Promise<DemographicsSnapshot> {
  const empty: DemographicsSnapshot = {
    topCities: [],
    ageBreakdown: {},
    genderSplit: {},
  };

  try {
    // Fetch all three breakdowns in parallel — each is a separate API call.
    const [ageData, genderData, cityData] = await Promise.all(
      DEMO_BREAKDOWNS.map((breakdown) =>
        graph(`${igUserId}/insights`, {
          token,
          params: {
            metric: "follower_demographics",
            period: "lifetime",
            metric_type: "total_value",
            breakdown,
          },
        }).catch(() => null)
      )
    );

    // Age breakdown.
    const ageBreakdown: Record<string, number> = {};
    for (const r of parseBreakdown(ageData?.data ?? [])) {
      const label = r.dimension_values?.[0];
      if (label) ageBreakdown[label] = (ageBreakdown[label] ?? 0) + (r.value ?? 0);
    }

    // Gender split.
    const genderSplit: Record<string, number> = {};
    for (const r of parseBreakdown(genderData?.data ?? [])) {
      const label = r.dimension_values?.[0];
      if (label) genderSplit[label] = (genderSplit[label] ?? 0) + (r.value ?? 0);
    }

    // Top cities — sort descending and take top 3.
    const cityMap: Record<string, number> = {};
    for (const r of parseBreakdown(cityData?.data ?? [])) {
      const label = r.dimension_values?.[0];
      if (label) cityMap[label] = (cityMap[label] ?? 0) + (r.value ?? 0);
    }
    const topCities = Object.entries(cityMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([city, count]) => ({ city, count }));

    return { topCities, ageBreakdown, genderSplit };
  } catch {
    return empty;
  }
}
