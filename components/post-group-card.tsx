"use client";

import Link from "next/link";
import type { PostGroup } from "@/lib/db/post-groups";
import type { ScheduledPost } from "@/lib/db/posts";
import { utcToCentral } from "@/lib/time";

// Status badge styles using design tokens
const STATUS_STYLES: Record<string, React.CSSProperties> = {
  scheduled: { background: "rgba(56,189,248,0.12)", color: "oklch(72% 0.15 230)" },
  publishing: { background: "rgba(217,119,6,0.12)", color: "oklch(72% 0.15 55)" },
  published: { background: "var(--green-dim)", color: "var(--green)" },
  failed: { background: "var(--red-dim)", color: "var(--red)" },
  canceled: { background: "var(--surface-hi)", color: "var(--text-dim)" },
  reminder_sent: { background: "rgba(217,119,6,0.12)", color: "oklch(72% 0.15 55)" },
  posted: { background: "var(--green-dim)", color: "var(--green)" },
};

// Friendly status label for a single platform row.
function rowStatusLabel(row: ScheduledPost): string {
  if (row.delivery === "reminder") {
    if (row.status === "scheduled") return "reminder";
    if (row.status === "reminder_sent") return "tap to post";
    if (row.status === "posted") return "posted";
  }
  if (row.status === "publishing" && row.publish_substate) {
    // Show a more specific video progress label.
    if (row.publish_substate === "staging") return "staging…";
    if (row.publish_substate === "ig_container_created") return "processing…";
    if (row.publish_substate === "fb_upload_started") return "uploading…";
    if (row.publish_substate === "fb_upload_done") return "finishing…";
  }
  return row.status;
}

interface Props {
  group: PostGroup;
  onAct: (id: string, action: "cancel" | "retry") => void;
}

// One card per compose session. Shows per-platform rows with individual times,
// statuses, and action buttons. Each platform succeeds/fails independently.
export function PostGroupCard({ group, onAct }: Props) {
  const isVideo = group.media_type === "video";
  const isGraphic = group.media_type === "graphic";

  return (
    <div
      className="rounded-lg p-3"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div className="flex gap-3">
        {/* Thumbnail: photo/video use auth-gated thumb endpoint; graphics show a label chip */}
        {group.photo_id && !isGraphic && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/thumb/${group.photo_id}`}
            alt=""
            className="h-16 w-16 shrink-0 rounded object-cover"
          />
        )}
        {isGraphic && (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded text-center text-xs font-medium"
            style={{ background: "var(--gold-dim)", color: "var(--gold)", border: "1px solid var(--gold-border)" }}
          >
            Graphic
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Caption preview */}
          <p className="line-clamp-2 text-sm" style={{ color: "var(--text-primary)" }}>
            {group.caption || <span style={{ color: "var(--text-dim)" }}>No caption</span>}
          </p>

          {isVideo && (
            <span className="mt-0.5 inline-block text-xs" style={{ color: "var(--text-dim)" }}>video / Reel</span>
          )}
          {isGraphic && (
            <span className="mt-0.5 inline-block text-xs" style={{ color: "var(--text-dim)" }}>branded graphic</span>
          )}

          {/* Per-platform rows */}
          <div className="mt-2 flex flex-col gap-1.5">
            {group.rows.map((row) => {
              const needsPosting =
                row.delivery === "reminder" && row.status === "reminder_sent";
              return (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-20 text-xs capitalize" style={{ color: "var(--text-dim)" }}>{row.platform}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs capitalize"
                    style={STATUS_STYLES[row.status] ?? {}}
                  >
                    {rowStatusLabel(row)}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {utcToCentral(row.scheduled_at)}
                  </span>
                  {row.error && (
                    <span className="text-xs" style={{ color: "var(--red)" }} title={row.error}>
                      error
                    </span>
                  )}
                  {/* Per-row actions */}
                  {needsPosting && (
                    <Link
                      href={`/post/${row.id}`}
                      className="text-xs font-medium underline"
                      style={{ color: "var(--gold)" }}
                    >
                      Post now →
                    </Link>
                  )}
                  {row.status === "scheduled" && (
                    <button
                      onClick={() => onAct(row.id, "cancel")}
                      className="text-xs underline"
                      style={{ color: "var(--text-dim)" }}
                    >
                      Cancel
                    </button>
                  )}
                  {row.status === "failed" && (
                    <button
                      onClick={() => onAct(row.id, "retry")}
                      className="text-xs underline"
                      style={{ color: "var(--gold)" }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
