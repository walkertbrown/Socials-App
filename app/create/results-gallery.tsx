"use client";

// ResultsGallery — side-by-side image picker shown after generation completes.
// The user clicks an image to select it for the text-overlay step.

interface GenerateResult {
  model: string;
  ok: boolean;
  pngBase64?: string;
  error?: string;
}

interface ResultsGalleryProps {
  results: GenerateResult[];
  modelLabel: Record<string, string>;
  onSelect: (model: string) => void;
}

export function ResultsGallery({
  results,
  modelLabel,
  onSelect,
}: ResultsGalleryProps) {
  return (
    <section className="flex flex-col gap-4">
      <p
        className="text-sm font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        Pick an image to continue:
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {results.map((r) => (
          <div key={r.model} className="flex flex-col gap-2">
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--gold)" }}
            >
              {modelLabel[r.model] ?? r.model}
            </p>
            {r.ok && r.pngBase64 ? (
              <button
                onClick={() => onSelect(r.model)}
                className="w-full rounded-lg overflow-hidden transition-opacity hover:opacity-90 focus:outline-none"
                style={{ border: "2px solid var(--border-hi)" }}
                aria-label={`Select ${modelLabel[r.model] ?? r.model}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${r.pngBase64}`}
                  alt={`${modelLabel[r.model] ?? r.model} result`}
                  className="w-full"
                />
              </button>
            ) : (
              <div
                className="flex items-center justify-center rounded-lg p-6 text-sm"
                style={{
                  background: "var(--surface-hi)",
                  color: "var(--red)",
                  minHeight: 160,
                }}
              >
                {r.error ?? "Generation failed"}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
