"use client";

import type { WindowKey } from "@/lib/report/window-ranges";

interface WindowSelectorProps {
  value: WindowKey;
  onChange: (w: WindowKey) => void;
}

const WINDOWS: WindowKey[] = ["daily", "weekly", "monthly", "alltime"];

// Short display labels for the segmented control buttons (not the eyebrow).
const BUTTON_LABELS: Record<WindowKey, string> = {
  daily: "Today",
  weekly: "Week",
  monthly: "30 Days",
  alltime: "All Time",
};

export function WindowSelector({ value, onChange }: WindowSelectorProps) {
  return (
    <div className="flex gap-1 rounded p-0.5" style={{ background: "var(--surface-hi)", border: "1px solid var(--border)" }}>
      {WINDOWS.map((w) => {
        const active = w === value;
        return (
          <button
            key={w}
            onClick={() => onChange(w)}
            className="flex-1 rounded px-2 py-1 text-xs font-medium transition-colors"
            style={
              active
                ? { background: "var(--gold-dim)", color: "var(--gold)", border: "1px solid var(--gold-border)" }
                : { color: "var(--text-dim)", border: "1px solid transparent" }
            }
          >
            {BUTTON_LABELS[w]}
          </button>
        );
      })}
    </div>
  );
}
