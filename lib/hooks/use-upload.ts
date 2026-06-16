"use client";

import { useState, useCallback } from "react";

export interface UploadFile {
  id: string; // temp local id before presign
  file: File;
  /** 0–100 */
  progress: number;
  /** "idle" | "presigning" | "uploading" | "processing" | "done" | "error" */
  stage: "idle" | "presigning" | "uploading" | "processing" | "done" | "error";
  error?: string;
  /** Supabase photo row id assigned by the presign endpoint */
  photoId?: string;
}

let nextLocalId = 0;

// Handles the full upload flow for one or more files:
//   presign → browser PUT → /api/process
// Files are processed sequentially to avoid saturating the connection.
// Per-file progress comes from XMLHttpRequest (fetch can't report upload progress).
export function useUpload(onAllDone: () => void) {
  const [uploads, setUploads] = useState<UploadFile[]>([]);

  const updateFile = useCallback((id: string, patch: Partial<UploadFile>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const startUpload = useCallback(
    async (files: FileList | File[]) => {
      const items: UploadFile[] = Array.from(files).map((file) => ({
        id: String(++nextLocalId),
        file,
        progress: 0,
        stage: "idle",
      }));

      // Add optimistic tiles immediately so the user sees something.
      setUploads((prev) => [...prev, ...items]);

      for (const item of items) {
        await uploadOne(item.id, item.file, updateFile);
      }

      // Give the caller a chance to refresh the board (e.g. router.refresh()).
      onAllDone();
    },
    [updateFile, onAllDone]
  );

  const clearDone = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.stage !== "done" && u.stage !== "error"));
  }, []);

  return { uploads, startUpload, clearDone };
}

// Process one file through the full pipeline. Updates state at each step.
async function uploadOne(
  localId: string,
  file: File,
  update: (id: string, patch: Partial<UploadFile>) => void
): Promise<void> {
  // Step 1: presign
  update(localId, { stage: "presigning", progress: 0 });
  let presignData: { id: string; uploadUrl: string; objectKey: string };
  try {
    const res = await fetch("/api/upload/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Presign failed: ${res.status}`);
    }
    presignData = await res.json();
  } catch (e) {
    update(localId, { stage: "error", error: (e as Error).message });
    return;
  }

  const { id: photoId, uploadUrl } = presignData;
  update(localId, { photoId, stage: "uploading", progress: 0 });

  // Step 2: PUT to MinIO — use XHR for progress reporting.
  const putOk = await new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        update(localId, { progress: Math.round((e.loaded / e.total) * 100) });
      }
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });

  if (!putOk) {
    // Abort: clean up the placeholder row.
    await fetch("/api/upload/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photoId }),
    }).catch(() => {});
    update(localId, { stage: "error", error: "Upload to storage failed", progress: 0 });
    return;
  }

  // Step 3: trigger processing (thumbnail + vision tag + auto-name).
  update(localId, { stage: "processing", progress: 100 });
  try {
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photoId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `Process failed: ${res.status}`);
    }
  } catch (e) {
    update(localId, { stage: "error", error: (e as Error).message });
    return;
  }

  update(localId, { stage: "done", progress: 100 });
}
