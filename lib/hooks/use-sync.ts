"use client";

import { useState, useCallback } from "react";

export interface SyncProgress {
  running: boolean;
  total: number;
  done: number;
  message: string;
}

const IDLE: SyncProgress = { running: false, total: 0, done: 0, message: "" };

// Runs a sync: ask the server for new files, then process them one at a time
// (one request per photo) so a big import can't time out a single function.
export function useSync(onComplete: () => void) {
  const [progress, setProgress] = useState<SyncProgress>(IDLE);

  const runSync = useCallback(async () => {
    setProgress({ ...IDLE, running: true, message: "Looking for new photos…" });

    const res = await fetch("/api/sync", { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setProgress({ ...IDLE, message: err.error ?? "Sync failed." });
      return;
    }

    const { processingIds, filesNew } = await res.json();
    const ids: string[] = processingIds ?? [];
    if (ids.length === 0) {
      setProgress({ ...IDLE, message: "No new photos." });
      onComplete();
      return;
    }

    setProgress({
      running: true,
      total: ids.length,
      done: 0,
      message: `Found ${filesNew} new. Processing…`,
    });

    let done = 0;
    for (const id of ids) {
      await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => {});
      done += 1;
      setProgress({
        running: true,
        total: ids.length,
        done,
        message: `Processing ${done}/${ids.length}…`,
      });
    }

    setProgress({ ...IDLE, message: `Done — ${ids.length} processed.` });
    onComplete();
  }, [onComplete]);

  return { progress, runSync };
}
