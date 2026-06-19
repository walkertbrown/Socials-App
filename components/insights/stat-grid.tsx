// Editorial stat grid — the bordered "ledger" of serif numbers from the design mock.
// One hairline grid (no gaps, no per-tile boxes): each cell is an eyebrow label, a
// big serif value, and an optional green/red week-over-week delta. The container
// supplies the top/left hairlines and every cell supplies its right/bottom, so the
// grid stays clean at any column count or wrap.

export interface Stat {
  label: string;
  value: string;
  delta?: number | null; // signed percent; null/0/omitted hides the delta
}

// Percent change of current vs prior; null when it can't be computed honestly.
export function pctDelta(
  current: number | null | undefined,
  prior: number | null | undefined,
): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return Math.round(((current - prior) / Math.abs(prior)) * 100);
}

function DeltaTag({ delta }: { delta: number }) {
  const up = delta > 0;
  return (
    <span
      className="tabular-nums"
      style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: up ? "var(--green)" : "var(--red)" }}
    >
      {up ? "+" : ""}
      {delta}%
    </span>
  );
}

interface StatGridProps {
  stats: Stat[];
  columnsClass?: string;
}

export function StatGrid({ stats, columnsClass = "grid-cols-2 sm:grid-cols-3" }: StatGridProps) {
  return (
    <div
      className={`grid ${columnsClass}`}
      style={{
        borderTop: "1px solid var(--line)",
        borderLeft: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="px-4 py-3.5"
          style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="eyebrow" style={{ marginBottom: 9 }}>
            {s.label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="tabular-nums"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 24, lineHeight: 1, color: "var(--text-primary)" }}
            >
              {s.value}
            </span>
            {s.delta != null && s.delta !== 0 && <DeltaTag delta={s.delta} />}
          </div>
        </div>
      ))}
    </div>
  );
}
