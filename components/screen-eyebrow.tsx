// ScreenEyebrow — mono uppercase label + serif title + optional sub-line.
// Used at the top of each hero screen to match the spec's consistent header pattern.

interface ScreenEyebrowProps {
  label: string;        // e.g. "COMMAND CENTER"
  title: string;        // e.g. "Provenance"
  subtitle?: string;    // optional second line
}

export function ScreenEyebrow({ label, title, subtitle }: ScreenEyebrowProps) {
  return (
    <div className="mb-6">
      <p className="eyebrow mb-1">{label}</p>
      <h1
        className="text-2xl tracking-tight"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 500, color: "var(--text-primary)" }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
