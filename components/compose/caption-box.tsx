"use client";

// CaptionBox — one platform's caption: a labeled textarea + its own "Draft" button.
// Rendered twice (Instagram + Facebook) by CaptionsSection so each platform gets
// its own AI draft and its own editable text.

interface CaptionBoxProps {
  label: string; // "Instagram" | "Facebook"
  caption: string;
  drafting: boolean;
  canDraft: boolean; // photo mode + a photo is selected
  active: boolean; // is this platform actually selected to post?
  onChange: (value: string) => void;
  onDraft: () => void;
}

export function CaptionBox({
  label,
  caption,
  drafting,
  canDraft,
  active,
  onChange,
  onDraft,
}: CaptionBoxProps) {
  return (
    <div style={{ opacity: active ? 1 : 0.55 }}>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
          {!active && (
            <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-dim)" }}>
              · not posting here
            </span>
          )}
        </p>
        <button
          onClick={onDraft}
          disabled={!canDraft || drafting}
          className="btn-teal rounded px-3 py-1 text-sm font-medium"
        >
          {drafting ? "Writing…" : `Draft ${label}`}
        </button>
      </div>
      <textarea
        value={caption}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={`Write the ${label} caption, or click Draft ${label}…`}
        className="w-full rounded p-2 text-sm"
        style={{
          border: "1px solid var(--border-hi)",
          background: "var(--surface-hi)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}
