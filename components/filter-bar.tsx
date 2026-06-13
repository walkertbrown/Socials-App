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
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => onChange(chip.key)}
          className={`rounded-full px-3 py-1 text-sm ${
            active === chip.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {chip.label}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-3">
        {progress.message && <span className="text-sm text-zinc-500">{progress.message}</span>}
        <button
          onClick={onSync}
          disabled={progress.running}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {progress.running ? "Sorting…" : "Sync & sort"}
        </button>
      </div>
    </div>
  );
}
