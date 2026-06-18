"use client";

// upload-csv.tsx — file picker that browser-parses a GuestCenter CSV and POSTs
// clean, opted-in rows to /api/outreach/ingest. Never sends the raw file.
//
// Flow:
//   1. User picks a .csv file.
//   2. Browser reads + parses it (parseGuestCsv).
//   3. Component POSTs the clean rows to the API.
//   4. API returns { ingested, personalized, standard, total }.
//   5. onComplete callback lets the parent update its bucket counts.

import { useRef, useState } from "react";
import { parseGuestCsv } from "@/lib/outreach/parse-guest-csv";
import type { BucketCounts } from "@/lib/outreach/types";

type Stage = "idle" | "parsing" | "uploading" | "done" | "error";

interface Props {
  onComplete: (counts: BucketCounts) => void;
}

export function UploadCsv({ onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleFile(file: File) {
    setStage("parsing");
    setMessage("Parsing CSV…");

    let text: string;
    try {
      text = await file.text();
    } catch {
      setStage("error");
      setMessage("Could not read the file.");
      return;
    }

    const rows = parseGuestCsv(text);
    if (rows.length === 0) {
      setStage("error");
      setMessage("No rows found. Make sure this is a GuestCenter export CSV.");
      return;
    }

    setStage("uploading");
    setMessage(`Uploading ${rows.length} parsed rows…`);

    let res: Response;
    try {
      res = await fetch("/api/outreach/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
    } catch {
      setStage("error");
      setMessage("Network error — could not reach the server.");
      return;
    }

    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body?.error ?? "";
      } catch {
        // ignore
      }
      setStage("error");
      setMessage(
        res.status === 413
          ? `Too many rows: ${detail}`
          : `Server error ${res.status}. ${detail}`
      );
      return;
    }

    const result = await res.json();
    setStage("done");
    setMessage(
      `Done. ${result.ingested} opted-in guests imported — ` +
      `${result.personalized} personalized, ${result.standard} standard.`
    );
    onComplete({
      personalized: result.personalized,
      standard: result.standard,
      total: result.total,
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
            e.target.value = "";
          }
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={stage === "parsing" || stage === "uploading"}
        style={{
          padding: "8px 18px",
          border: "1px solid var(--border-hi)",
          borderRadius: 8,
          background: "var(--surface-hi)",
          color: "var(--text-secondary)",
          fontSize: 14,
          cursor:
            stage === "parsing" || stage === "uploading" ? "not-allowed" : "pointer",
          opacity: stage === "parsing" || stage === "uploading" ? 0.5 : 1,
        }}
      >
        {stage === "parsing" || stage === "uploading"
          ? "Working…"
          : "Upload GuestCenter CSV"}
      </button>

      {message && (
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color:
              stage === "error"
                ? "var(--red)"
                : stage === "done"
                ? "var(--green)"
                : "var(--text-secondary)",
          }}
        >
          {message}
        </p>
      )}

      {(stage === "done" || stage === "error") && (
        <button
          onClick={() => {
            setStage("idle");
            setMessage("");
          }}
          style={{
            marginTop: 4,
            fontSize: 12,
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Upload another
        </button>
      )}
    </div>
  );
}
