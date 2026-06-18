"use client";

// use-campaign-run.ts — encapsulates the verify+generate sequential run loop
// for a single bucket. Extracted from campaigns-view.tsx to stay under 300 lines.

import { useState } from "react";

export type RunState = "idle" | "running" | "done" | "quota_exhausted";

export interface RunProgress {
  total:     number;
  processed: number;
  generated: number;
  skipped:   number;
  failed:    number;
  offset:    number;
}

const BATCH_CAP = 100;

async function fetchGuestIds(bucket: string, offset: number): Promise<string[]> {
  const res = await fetch(
    `/api/outreach/guests-for-run?bucket=${bucket}&limit=${BATCH_CAP}&offset=${offset}`
  );
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as { ids: string[] };
  return json.ids;
}

export function useCampaignRun(
  bucket: "personalized" | "standard",
  onComplete?: () => void,
  skipVerify = false
) {
  const [runState, setRunState]    = useState<RunState>("idle");
  const [progress, setProgress]    = useState<RunProgress | null>(null);
  const [error, setError]          = useState<string | null>(null);
  const [quotaMsg, setQuotaMsg]    = useState<string | null>(null);
  const [cursor, setCursor]        = useState(0);

  async function runBatch(ids: string[], offset: number) {
    setRunState("running");
    setError(null);
    setQuotaMsg(null);

    const prog: RunProgress = {
      total: ids.length, processed: 0, generated: 0, skipped: 0, failed: 0, offset,
    };
    setProgress({ ...prog });

    for (const id of ids) {
      if (!skipVerify) {
        // Step 1: verify (sequential, never parallel).
        const verRes = await fetch("/api/outreach/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guest_id: id }),
        });
        const verJson = (await verRes.json()) as {
          status: string;
          quota_exhausted?: boolean;
          message?: string;
        };

        if (verJson.quota_exhausted) {
          setQuotaMsg(verJson.message ?? "Email-verification limit reached — resets daily, or add credits.");
          setRunState("quota_exhausted");
          setProgress({ ...prog });
          return;
        }

        if (verJson.status === "invalid") {
          prog.skipped++;
          prog.processed++;
          setProgress({ ...prog });
          continue;
        }
      }

      // Step 2: generate draft (skipVerify passed through so the server-side gate
      // is also bypassed when testing).
      const genRes = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_id: id, skipVerify }),
      });

      if (!genRes.ok) {
        prog.failed++;
      } else {
        const genJson = (await genRes.json()) as { status: string };
        if (genJson.status === "generated") prog.generated++;
        else prog.skipped++;
      }

      prog.processed++;
      setProgress({ ...prog });
    }

    setRunState("done");
    setProgress({ ...prog });
    onComplete?.();
  }

  async function handleRun() {
    setError(null);
    setQuotaMsg(null);
    setProgress(null);
    setCursor(0);

    let ids: string[];
    try {
      ids = await fetchGuestIds(bucket, 0);
    } catch (e) {
      setError((e as Error).message);
      return;
    }

    if (ids.length === 0) {
      setProgress({ total: 0, processed: 0, generated: 0, skipped: 0, failed: 0, offset: 0 });
      setRunState("done");
      return;
    }

    setCursor(ids.length);
    await runBatch(ids, 0);
  }

  async function handleContinue() {
    let ids: string[];
    try {
      ids = await fetchGuestIds(bucket, cursor);
    } catch (e) {
      setError((e as Error).message);
      return;
    }

    if (ids.length === 0) {
      setRunState("done");
      return;
    }

    setCursor((prev) => prev + ids.length);
    await runBatch(ids, cursor);
  }

  // Only offer "generate next 100" after a clean batch — NOT when credits are
  // exhausted (continuing would immediately hit the quota again; the quota
  // message tells the user to top up, then re-run).
  const canContinue =
    runState === "done" && (progress?.total ?? 0) >= BATCH_CAP;

  return {
    runState,
    progress,
    error,
    quotaMsg,
    canContinue,
    handleRun,
    handleContinue,
  };
}
