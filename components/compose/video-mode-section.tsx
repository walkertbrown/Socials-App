"use client";

// VideoModeSection — "Post it for me" vs "Remind me" toggle + helper text.
// Extracted from compose-client.tsx to keep that file under the 300-line ceiling.

interface VideoModeSectionProps {
  delivery: "auto" | "reminder";
  onDeliveryChange: (d: "auto" | "reminder") => void;
}

export function VideoModeSection({ delivery, onDeliveryChange }: VideoModeSectionProps) {
  return (
    <section>
      <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        Video publish mode
      </p>
      <div className="flex gap-2">
        {(["auto", "reminder"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDeliveryChange(d)}
            className="rounded-full px-4 py-1.5 text-sm transition-colors"
            style={
              delivery === d
                ? { background: "var(--gold)", color: "var(--on-accent)" }
                : { background: "var(--surface-hi)", color: "var(--text-secondary)" }
            }
          >
            {d === "auto" ? "Post it for me (Reel)" : "Remind me"}
          </button>
        ))}
      </div>
      {delivery === "reminder" && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          We will ping your phone at the scheduled time so you can add trending audio and post it yourself.
        </p>
      )}
    </section>
  );
}
