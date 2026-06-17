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
  onSetPlatforms: (platforms: string[]) => void;
  isVideo: boolean;
}

// The three "Where" choices. "Both" cross-posts (the default).
const WHERE_OPTIONS = [
  { key: "both", label: "Both", platforms: ["instagram", "facebook"] },
  { key: "instagram", label: "Instagram", platforms: ["instagram"] },
  { key: "facebook", label: "Facebook", platforms: ["facebook"] },
];

export function PlatformSchedule({
  items,
  sharedWhen,
  onSharedWhenChange,
  onItemChange,
  onSetPlatforms,
  isVideo,
}: Props) {
  const activePlatforms = new Set(items.map((i) => i.platform));
  const igActive = activePlatforms.has("instagram");
  const fbActive = activePlatforms.has("facebook");
  const whereMode = igActive && fbActive ? "both" : fbActive ? "facebook" : "instagram";

  return (
    <div className="flex flex-col gap-3">
      {/* Where — Both (cross-post) / Instagram / Facebook */}
      <div>
        <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>4. Where</p>
        <div className="flex gap-2">
          {WHERE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onSetPlatforms(o.platforms)}
              className="rounded-full px-4 py-1.5 text-sm transition-colors"
              style={
                whereMode === o.key
                  ? { background: "var(--gold)", color: "var(--bg)" }
                  : { background: "var(--surface-hi)", color: "var(--text-secondary)" }
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shared default time */}
      <div>
        <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>5. When (Central Time)</p>
        <input
          type="datetime-local"
          value={sharedWhen}
          onChange={(e) => onSharedWhenChange(e.target.value)}
          className="rounded-md p-2 text-sm"
          style={{
            border: "1px solid var(--border-hi)",
            background: "var(--surface-hi)",
            color: "var(--text-primary)",
          }}
        />
        {items.some((i) => i.overridden) && (
          <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
            Overridden platforms keep their own time even if you change the default above.
          </p>
        )}
      </div>

      {/* Per-platform time rows (only shown when both platforms are active) */}
      {items.length > 1 && (
        <div
          className="rounded-md p-3"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Per-platform times
          </p>
          {items.map((item) => (
            <div key={item.platform} className="mb-2 flex items-center gap-3 last:mb-0">
              <span className="w-24 text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{item.platform}</span>
              <input
                type="datetime-local"
                value={item.scheduled_at}
                onChange={(e) => onItemChange(item.platform, e.target.value)}
                className="rounded-md p-1.5 text-sm"
                style={{
                  border: `1px solid ${item.overridden ? "var(--gold-border)" : "var(--border-hi)"}`,
                  background: item.overridden ? "var(--gold-dim)" : "var(--surface-hi)",
                  color: "var(--text-primary)",
                }}
              />
              {item.overridden && (
                <span className="text-xs" style={{ color: "var(--gold)" }}>custom</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video delivery note */}
      {isVideo && (
        <p
          className="rounded-md p-2 text-xs"
          style={{ background: "rgba(217,119,6,0.08)", color: "oklch(75% 0.12 55)" }}
        >
          This is a video — it will be published as a Reel automatically (&quot;Post it for me&quot;).
          Switch to &quot;Remind me&quot; below if you&apos;d rather post it yourself.
        </p>
      )}
    </div>
  );
}
