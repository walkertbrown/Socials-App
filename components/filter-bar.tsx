"use client";

import { CONTENT_TAGS, type ContentTag } from "@/lib/tags";
import type { SyncProgress } from "@/lib/hooks/use-sync";

export type TagFilter = ContentTag | "all";

interface Props {
  active: TagFilter;
  onChange: (tag: TagFilter) => void;
  showOnlyPicked: boolean;
  onTogglePicked: () => void;
  onSync: () => void;
  progress: SyncProgress;
}

export function FilterBar({
  active,
  onChange,
  showOnlyPicked,
  onTogglePicked,
  onSync,
  progress,
}: Props) {
  const chips: TagFilter[] = ["all", ...CONTENT_TAGS];

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onChange(chip)}
          className={`rounded-full px-3 py-1 text-sm capitalize ${
            active === chip ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {chip}
        </button>
      ))}

      <label className="ml-2 flex items-center gap-1.5 text-sm text-zinc-700">
        <input type="checkbox" checked={showOnlyPicked} onChange={onTogglePicked} />
        Picked only
      </label>

      <div className="ml-auto flex items-center gap-3">
        {progress.message && (
          <span className="text-sm text-zinc-500">{progress.message}</span>
        )}
        <button
          onClick={onSync}
          disabled={progress.running}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {progress.running ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </div>
  );
}
