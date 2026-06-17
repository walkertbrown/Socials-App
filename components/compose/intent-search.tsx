"use client";

// IntentSearch — "What do you want to post about?" section with quick-tag chips.
// Extracted from compose-client.tsx to keep that file under the 300-line ceiling.

const QUICK_TAGS = ["staff", "cocktails", "food", "patio", "events", "wine"];

interface IntentSearchProps {
  intent: string;
  searching: boolean;
  matchedIds: string[] | null;
  onIntentChange: (value: string) => void;
  onSearch: (term?: string) => void;
  onClear: () => void;
}

export function IntentSearch({
  intent,
  searching,
  matchedIds,
  onIntentChange,
  onSearch,
  onClear,
}: IntentSearchProps) {
  return (
    <section>
      <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        2. What do you want to post about?
      </p>
      <div className="flex gap-2">
        <input
          value={intent}
          onChange={(e) => onIntentChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="e.g. a post about the staff, this weekend, the BBQ shrimp…"
          className="w-full rounded p-2 text-sm"
          style={{
            border: "1px solid var(--border-hi)",
            background: "var(--surface-hi)",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={() => onSearch()}
          disabled={searching}
          className="shrink-0 rounded px-3 py-1 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--gold)", color: "var(--on-accent)" }}
        >
          {searching ? "Finding…" : "Find photos"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_TAGS.map((t) => (
          <button
            key={t}
            onClick={() => onSearch(t)}
            className="rounded-full px-3 py-1 text-xs capitalize transition-colors"
            style={{ background: "var(--surface-hi)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gold-dim)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-hi)")}
          >
            {t}
          </button>
        ))}
      </div>
      {matchedIds !== null && (
        <button onClick={onClear} className="mt-2 text-xs underline" style={{ color: "var(--text-dim)" }}>
          Showing matches{intent.trim() ? ` for "${intent.trim()}"` : ""} · clear
        </button>
      )}
      <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
        Optional — leave blank to browse everything.
      </p>
    </section>
  );
}
