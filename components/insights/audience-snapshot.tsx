"use client";

// Audience snapshot — IG ONLY.
// FB demographics are unavailable (API restriction per ground truth).
// Parses the stored demographics JSON blob from weekly_account_snapshots.

import type { DemographicsSnapshot } from "@/lib/meta/demographics";

interface AudienceSnapshotProps {
  demographics: DemographicsSnapshot | null;
}

export function AudienceSnapshot({ demographics }: AudienceSnapshotProps) {
  if (!demographics || (!demographics.topCities.length && !Object.keys(demographics.ageBreakdown).length)) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-1 text-sm font-medium text-zinc-700">Audience Snapshot</div>
        <p className="text-xs italic text-zinc-400 mb-2">Instagram only — FB audience data unavailable.</p>
        <p className="text-sm text-zinc-400">Audience data not yet available.</p>
      </div>
    );
  }

  const { topCities, ageBreakdown, genderSplit } = demographics;

  // Sort age buckets for display.
  const ageBuckets = Object.entries(ageBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const totalGender = Object.values(genderSplit).reduce((s, v) => s + v, 0);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-1 text-sm font-medium text-zinc-700">Audience Snapshot</div>
      <p className="text-xs italic text-zinc-400 mb-4">Instagram only (lifetime) — FB audience data unavailable.</p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Top cities */}
        {topCities.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">Top Cities</div>
            <ol className="flex flex-col gap-1">
              {topCities.map(({ city, count }, i) => (
                <li key={city} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700">
                    <span className="text-zinc-400 mr-1">{i + 1}.</span>
                    {city}
                  </span>
                  <span className="tabular-nums text-zinc-500">{count.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Age breakdown */}
        {ageBuckets.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">Age Groups</div>
            <div className="flex flex-col gap-1">
              {ageBuckets.map(([bucket, count]) => (
                <div key={bucket} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700">{bucket}</span>
                  <span className="tabular-nums text-zinc-500">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gender split */}
        {totalGender > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">Gender Split</div>
            <div className="flex flex-col gap-1">
              {Object.entries(genderSplit)
                .sort(([, a], [, b]) => b - a)
                .map(([gender, count]) => {
                  const pct = totalGender > 0 ? Math.round((count / totalGender) * 100) : 0;
                  return (
                    <div key={gender} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700">{gender}</span>
                      <span className="tabular-nums text-zinc-500">{pct}%</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
