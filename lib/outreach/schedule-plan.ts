// schedule-plan.ts — warm-up ramp prefill + small date helpers.
// Pure (no server imports): used by the API to suggest a starting plan and by
// the UI to render/extend it. The ramp protects a brand-new sending domain —
// start small, climb gradually, with the engaged warm cohort first.

// Daily batch sizes for the warm-up climb. After the last step, any remaining
// pool is sent at the final step size per day until exhausted.
export const RAMP_STEPS = [50, 100, 200, 350, 500];

export interface PlanRow {
  scheduled_date: string; // YYYY-MM-DD
  target_count: number;
}

// Today's date in America/Chicago as YYYY-MM-DD (en-CA gives ISO ordering).
export function todayChicago(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

// Add n whole days to a YYYY-MM-DD string. Anchored at noon UTC so a DST shift
// never rolls the date backward or forward.
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Build the warm-up ramp covering `poolSize` emails, one batch per day starting
// at `startDate`. Returns [] for an empty pool.
export function buildRampPlan(startDate: string, poolSize: number): PlanRow[] {
  const rows: PlanRow[] = [];
  let remaining = Math.max(0, Math.floor(poolSize));
  let day = 0;
  const stepFor = (i: number) => RAMP_STEPS[i] ?? RAMP_STEPS[RAMP_STEPS.length - 1];
  while (remaining > 0) {
    const count = Math.min(stepFor(day), remaining);
    rows.push({ scheduled_date: addDays(startDate, day), target_count: count });
    remaining -= count;
    day += 1;
  }
  return rows;
}
