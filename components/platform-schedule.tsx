"use client";

// Per-platform time rows for the compose screen.
//
// Behaviour:
// - Changing the "shared" datetime-local input updates ALL platform times that
//   haven't been individually overridden (i.e. times that are still equal to
//   the last shared value).
// - Once a per-platform time is manually changed it "sticks" — further changes
//   to the shared input won't overwrite it.
// - Toggling a platform off removes its row; toggling back on restores the
//   current shared time (reset to un-overridden).

export interface PlatformItem {
  platform: string;
  scheduled_at: string; // local datetime-local string ("YYYY-MM-DDTHH:mm")
  delivery: "auto" | "reminder";
  // Tracks whether this platform's time has been manually overridden.
  overridden: boolean;
}

interface Props {
  items: PlatformItem[];
  sharedWhen: string;
  onSharedWhenChange: (when: string) => void;
  onItemChange: (platform: string, when: string) => void;
  onTogglePlatform: (platform: string) => void;
  isVideo: boolean;
}

const PLATFORMS = ["instagram", "facebook"];

export function PlatformSchedule({
  items,
  sharedWhen,
  onSharedWhenChange,
  onItemChange,
  onTogglePlatform,
  isVideo,
}: Props) {
  const activePlatforms = new Set(items.map((i) => i.platform));

  return (
    <div className="flex flex-col gap-3">
      {/* Platform toggles */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">4. Where</p>
        <div className="flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onTogglePlatform(p)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${
                activePlatforms.has(p)
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Shared default time */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">5. When (Central Time)</p>
        <input
          type="datetime-local"
          value={sharedWhen}
          onChange={(e) => onSharedWhenChange(e.target.value)}
          className="rounded-md border border-zinc-300 p-2 text-sm"
        />
        {items.some((i) => i.overridden) && (
          <p className="mt-1 text-xs text-zinc-400">
            Overridden platforms keep their own time even if you change the default above.
          </p>
        )}
      </div>

      {/* Per-platform time rows (only shown when both platforms are active) */}
      {items.length > 1 && (
        <div className="rounded-md border border-zinc-200 p-3">
          <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Per-platform times
          </p>
          {items.map((item) => (
            <div key={item.platform} className="mb-2 flex items-center gap-3 last:mb-0">
              <span className="w-24 text-sm capitalize text-zinc-700">{item.platform}</span>
              <input
                type="datetime-local"
                value={item.scheduled_at}
                onChange={(e) => onItemChange(item.platform, e.target.value)}
                className={`rounded-md border p-1.5 text-sm ${
                  item.overridden
                    ? "border-blue-400 bg-blue-50"
                    : "border-zinc-300"
                }`}
              />
              {item.overridden && (
                <span className="text-xs text-blue-600">custom</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video delivery note */}
      {isVideo && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          This is a video — it will be published as a Reel automatically ("Post it for me").
          Switch to "Remind me" below if you'd rather post it yourself.
        </p>
      )}
    </div>
  );
}
