"use client";

import { useState, useRef } from "react";
import { CutLineEditor } from "./cut-line-editor";
import { OutputCard } from "./output-card";

type Step = "idle" | "loading-preview" | "preview" | "generating" | "results";

interface Results {
  fullPage: string;
  sections: string[];
}

// Renders page 1 of a PDF file to an HTMLCanvasElement at the given pixel width.
// Loads pdfjs-dist dynamically (already in node_modules via pdf-to-img).
async function renderPdfToCanvas(file: File, targetWidth: number): Promise<HTMLCanvasElement> {
  const pdfjsLib = await import("pdfjs-dist");
  // Use unpkg CDN for the worker — avoids Next.js bundler complications.
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const page = await pdf.getPage(1);

  const nativeVp = page.getViewport({ scale: 1 });
  const scale = targetWidth / nativeVp.width;
  const vp = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise;
  return canvas;
}

// Safely parse a fetch response as JSON, surfacing a real error if the server
// returns HTML (e.g. a Next.js 500 page).
async function parseJson(res: Response) {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`Server error (${res.status}) — check logs`);
  }
  return res.json();
}

export function MenuClient() {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [cuts, setCuts] = useState<number[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const fileRef = useRef<File | null>(null);

  function reset() {
    setStep("idle");
    setError(null);
    setPreviewSrc(null);
    setCuts([]);
    setResults(null);
    fileRef.current = null;
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem("pdf") as HTMLInputElement);
    const file = input.files?.[0];
    if (!file) return;

    fileRef.current = file;
    setStep("loading-preview");
    setError(null);

    try {
      // Render PDF page 1 at 900px wide in the browser — no server call needed.
      const canvas = await renderPdfToCanvas(file, 900);
      setPreviewSrc(canvas.toDataURL("image/png"));
      setCuts([]);
      setStep("preview");
    } catch (err) {
      setError((err as Error).message);
      setStep("idle");
    }
  }

  async function handleGenerate() {
    if (!fileRef.current || cuts.length === 0) return;

    setStep("generating");
    setError(null);

    try {
      // Re-render at full resolution for the final output.
      const canvas = await renderPdfToCanvas(fileRef.current, 1800);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png")
      );

      const fd = new FormData();
      fd.append("image", blob, "menu.png");
      fd.append("cuts", JSON.stringify(cuts));

      const res = await fetch("/api/menu/process", { method: "POST", body: fd });
      const json = await parseJson(res);
      if (!res.ok) throw new Error(json.error ?? "Generate failed");

      setResults({ fullPage: json.fullPage, sections: json.sections });
      setStep("results");
    } catch (err) {
      setError((err as Error).message);
      setStep("preview");
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: "#111" }}>Menu Maker</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
        PDF menu → full-page PNG (Google) + square sections (Instagram).
      </p>

      {error && (
        <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {(step === "idle" || step === "loading-preview") && (
        <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="file" name="pdf" accept="application/pdf" required
            style={{ fontSize: 14, color: "#555" }} />
          <button type="submit" disabled={step === "loading-preview"}
            style={{ alignSelf: "flex-start", padding: "8px 20px", background: "#0f3d3e", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: step === "loading-preview" ? 0.6 : 1 }}>
            {step === "loading-preview" ? "Rendering preview…" : "Upload & Preview"}
          </button>
        </form>
      )}

      {(step === "preview" || step === "generating") && previewSrc && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, color: "#888" }}>Click to add cut lines. Drag to adjust. Click × to remove.</p>
          <CutLineEditor previewSrc={previewSrc} onChange={setCuts} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={handleGenerate} disabled={cuts.length === 0 || step === "generating"}
              style={{ padding: "8px 20px", background: "#0f3d3e", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: (cuts.length === 0 || step === "generating") ? 0.5 : 1 }}>
              {step === "generating" ? "Generating…" : "Generate"}
            </button>
            <button onClick={reset} style={{ fontSize: 13, color: "#aaa", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Start over
            </button>
          </div>
        </div>
      )}

      {step === "results" && results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
            <OutputCard base64Png={results.fullPage} filename="menu-full.png" label="Full page" />
            {results.sections.map((s, i) => (
              <OutputCard key={i} base64Png={s} filename={`menu-section-${i + 1}.png`} label={`Section ${i + 1}`} />
            ))}
          </div>
          <button onClick={reset}
            style={{ alignSelf: "flex-start", padding: "8px 18px", background: "#f0f0f0", color: "#555", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer" }}>
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
