"use client";

import { useRef } from "react";
import { useUpload, type UploadFile } from "@/lib/hooks/use-upload";

interface Props {
  /** Called when all files in a batch have finished (done or error). */
  onComplete: () => void;
}

export function UploadButton({ onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploads, startUpload, clearDone } = useUpload(onComplete);

  const anyActive = uploads.some((u) => u.stage === "presigning" || u.stage === "uploading" || u.stage === "processing");

  return (
    <div>
      {/* Hidden file input — triggered by the visible button. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            startUpload(e.target.files);
            // Reset so the same file can be re-selected if needed.
            e.target.value = "";
          }
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={anyActive}
        className="rounded-md px-3 py-1.5 text-sm transition-colors hover:opacity-90 disabled:opacity-50"
        style={{
          border: "1px solid var(--border-hi)",
          color: "var(--text-secondary)",
          background: "var(--surface-hi)",
        }}
      >
        Upload photos
      </button>

      {/* Per-file progress list — shown while uploads are in flight. */}
      {uploads.length > 0 && (
        <div className="mt-2 space-y-1">
          {uploads.map((u) => (
            <UploadRow key={u.id} upload={u} />
          ))}
          {!anyActive && (
            <button
              onClick={clearDone}
              className="text-xs underline"
              style={{ color: "var(--text-dim)" }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UploadRow({ upload }: { upload: UploadFile }) {
  const { file, stage, progress, error } = upload;
  const name = file.name.length > 30 ? file.name.slice(0, 28) + "…" : file.name;

  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
      <span className="w-40 truncate">{name}</span>
      {stage === "uploading" && (
        <div
          className="h-1.5 w-24 overflow-hidden rounded-full"
          style={{ background: "var(--surface-hi)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: "var(--gold)" }}
          />
        </div>
      )}
      {stage === "presigning" && <span style={{ color: "var(--text-dim)" }}>preparing…</span>}
      {stage === "processing" && <span style={{ color: "var(--text-dim)" }}>processing…</span>}
      {stage === "done" && <span style={{ color: "var(--green)" }}>done</span>}
      {stage === "error" && <span style={{ color: "var(--red)" }} title={error}>failed</span>}
    </div>
  );
}
