"use client";

import { CATEGORIES } from "@/lib/categories";
import type { SyncProgress } from "@/lib/hooks/use-sync";

interface Props {
  active: string;
  onChange: (key: string) => void;
  onSync: () => void;
  progress: SyncProgress;
}

export function FilterBar({ active, onChange, onSync, progress }: Props) {
  const chips = [{ key: "all", label: "All" }, ...CATEGORIES.map((c) => ({ key: c.key, label: c.label }))];

  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-3 backdrop-blur"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => onChange(chip.key)}
          className="rounded-full px-3 py-1 text-sm transition-colors"
          style={
            active === chip.key
              ? { background: "var(--gold)", color: "var(--bg)" }
              : { background: "var(--surface-hi)", color: "var(--text-dim)" }
          }
        >
          {chip.label}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-3">
        {progress.message && (
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {progress.message}
          </span>
        )}
        <button
          onClick={onSync}
          disabled={progress.running}
          className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--gold)", color: "var(--bg)" }}
        >
          {progress.running ? "Sorting…" : "Sync & sort"}
        </button>
      </div>
    </div>
  );
}
