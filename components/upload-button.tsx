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
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
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
              className="text-xs text-zinc-500 underline"
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
    <div className="flex items-center gap-2 text-xs text-zinc-600">
      <span className="w-40 truncate">{name}</span>
      {stage === "uploading" && (
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {stage === "presigning" && <span className="text-zinc-400">preparing…</span>}
      {stage === "processing" && <span className="text-zinc-400">processing…</span>}
      {stage === "done" && <span className="text-green-600">done</span>}
      {stage === "error" && <span className="text-red-600" title={error}>failed</span>}
    </div>
  );
}
