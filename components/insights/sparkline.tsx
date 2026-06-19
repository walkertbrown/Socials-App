// Smooth filled-area sparkline — the editorial trend line from the design mock.
// Draws a soft accent area beneath a thin accent stroke. Stretches to its container
// width (preserveAspectRatio="none"), so it reads as a quiet backdrop, not a chart.
// Caller should gate on having ≥2 points before rendering.

interface SparklineProps {
  data: number[];
  height?: number;
}

export function Sparkline({ data, height = 64 }: SparklineProps) {
  const w = 300;
  const h = height;
  const pad = 3;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1; // avoid divide-by-zero when the series is flat

  const pts = data.map((v, i) => {
    const x = pad + (data.length === 1 ? 0 : (i / (data.length - 1)) * (w - pad * 2));
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <polygon points={area} fill="var(--gold-dim)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
