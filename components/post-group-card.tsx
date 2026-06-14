"use client";

import Link from "next/link";
import type { PostGroup } from "@/lib/db/post-groups";
import type { ScheduledPost } from "@/lib/db/posts";
import { utcToCentral } from "@/lib/time";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  publishing: "bg-amber-100 text-amber-700",
  published: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  canceled: "bg-zinc-200 text-zinc-500",
  reminder_sent: "bg-amber-100 text-amber-700",
  posted: "bg-emerald-100 text-emerald-700",
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
    <div className="rounded-lg border border-zinc-200 p-3">
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
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-[#1c3149] text-center text-xs font-medium text-[#f3ecdd]">
            Graphic
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Caption preview */}
          <p className="line-clamp-2 text-sm text-zinc-700">
            {group.caption || <span className="text-zinc-400">No caption</span>}
          </p>

          {isVideo && (
            <span className="mt-0.5 inline-block text-xs text-zinc-400">video / Reel</span>
          )}
          {isGraphic && (
            <span className="mt-0.5 inline-block text-xs text-zinc-400">branded graphic</span>
          )}

          {/* Per-platform rows */}
          <div className="mt-2 flex flex-col gap-1.5">
            {group.rows.map((row) => {
              const needsPosting =
                row.delivery === "reminder" && row.status === "reminder_sent";
              return (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-20 text-xs capitalize text-zinc-500">{row.platform}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs capitalize ${STATUS_STYLES[row.status] ?? ""}`}
                  >
                    {rowStatusLabel(row)}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {utcToCentral(row.scheduled_at)}
                  </span>
                  {row.error && (
                    <span className="text-xs text-red-600" title={row.error}>
                      error
                    </span>
                  )}
                  {/* Per-row actions */}
                  {needsPosting && (
                    <Link
                      href={`/post/${row.id}`}
                      className="text-xs font-medium text-pink-600 underline"
                    >
                      Post now →
                    </Link>
                  )}
                  {row.status === "scheduled" && (
                    <button
                      onClick={() => onAct(row.id, "cancel")}
                      className="text-xs text-zinc-500 underline"
                    >
                      Cancel
                    </button>
                  )}
                  {row.status === "failed" && (
                    <button
                      onClick={() => onAct(row.id, "retry")}
                      className="text-xs text-blue-600 underline"
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
