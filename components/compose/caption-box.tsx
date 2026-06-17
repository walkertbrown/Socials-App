"use client";

// CaptionBox — the caption textarea + "Draft with AI" button.
// Extracted from compose-client.tsx to keep that file under the 300-line ceiling.

interface CaptionBoxProps {
  caption: string;
  mediaMode: "photo" | "graphic";
  selectedIds: string[];
  drafting: boolean;
  stepNumber: number; // "4" in photo mode, "2" in graphic mode
  onChange: (value: string) => void;
  onDraft: () => void;
}

export function CaptionBox({
  caption,
  mediaMode,
  selectedIds,
  drafting,
  stepNumber,
  onChange,
  onDraft,
}: CaptionBoxProps) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {stepNumber}. Caption
        </p>
        <button
          onClick={onDraft}
          disabled={mediaMode !== "photo" || selectedIds.length === 0 || drafting}
          className="btn-teal rounded px-3 py-1 text-sm font-medium"
        >
          {drafting ? "Writing…" : "Draft with AI"}
        </button>
      </div>
      <textarea
        value={caption}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Write a caption, or click Draft with AI…"
        className="w-full rounded p-2 text-sm"
        style={{
          border: "1px solid var(--border-hi)",
          background: "var(--surface-hi)",
          color: "var(--text-primary)",
        }}
      />
    </section>
  );
}
