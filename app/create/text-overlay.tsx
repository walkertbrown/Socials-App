"use client";

// Browser-side Canvas text overlay. Renders the selected AI image and lets
// Elizabeth type text, drag it to reposition, and resize it — all in real time
// with no server round-trips. Export composites image + text at full output
// resolution as a base64 PNG.

import { useRef, useEffect, useState, useCallback } from "react";

// Output resolution matches the platform spec for each format.
const OUTPUT_SIZES = {
  feed: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

// Preview fits inside the viewport; we scale up to full res on export.
const PREVIEW_WIDTH = 400;

interface TextOverlayProps {
  imageDataUrl: string;
  format: "feed" | "story";
  onExport: (pngBase64: string) => void;
}

interface TextState {
  text: string;
  // Position as fraction of canvas dimensions (0–1) so it scales correctly.
  xFrac: number;
  yFrac: number;
  // Font size as fraction of canvas width.
  sizeFrac: number;
}

const DEFAULT_TEXT: TextState = {
  text: "",
  xFrac: 0.5,
  yFrac: 0.85,
  sizeFrac: 0.055,
};

export function TextOverlay({ imageDataUrl, format, onExport }: TextOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [textState, setTextState] = useState<TextState>(DEFAULT_TEXT);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const { w: outW, h: outH } = OUTPUT_SIZES[format];
  // Preview canvas dimensions: maintain aspect ratio at PREVIEW_WIDTH.
  const previewH = Math.round((PREVIEW_WIDTH / outW) * outH);
  const scale = PREVIEW_WIDTH / outW; // preview-to-output scale factor

  // Draw the image + text onto the preview canvas.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = imgRef.current;

    // Clear and draw base image.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img?.complete) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    if (!textState.text) return;

    const px = textState.xFrac * canvas.width;
    const py = textState.yFrac * canvas.height;
    const fontSize = Math.round(textState.sizeFrac * canvas.width);

    ctx.font = `700 ${fontSize}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Subtle shadow for legibility over any background.
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = Math.round(fontSize * 0.15);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(fontSize * 0.04);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(textState.text, px, py);

    // Reset shadow so it doesn't bleed.
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }, [textState]);

  // Load the image once and redraw whenever it or text changes.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ── Drag to reposition ────────────────────────────────────────────────────

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = getCanvasPoint(e);
    const textX = textState.xFrac * outW;
    const textY = textState.yFrac * outH;
    // Start drag from anywhere (simple UX — not hit-testing the text bounds).
    dragOffsetRef.current = { x: pt.x - textX, y: pt.y - textY };
    setDragging(true);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const pt = getCanvasPoint(e);
    const newX = pt.x - dragOffsetRef.current.x;
    const newY = pt.y - dragOffsetRef.current.y;
    setTextState((prev) => ({
      ...prev,
      xFrac: Math.max(0, Math.min(1, newX / outW)),
      yFrac: Math.max(0, Math.min(1, newY / outH)),
    }));
  }

  function onPointerUp() {
    setDragging(false);
  }

  // ── Export at full resolution ─────────────────────────────────────────────

  function handleExport() {
    const offscreen = document.createElement("canvas");
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    const img = imgRef.current;
    if (img?.complete) {
      ctx.drawImage(img, 0, 0, outW, outH);
    }

    if (textState.text) {
      const fontSize = Math.round(textState.sizeFrac * outW);
      ctx.font = `700 ${fontSize}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = Math.round(fontSize * 0.15);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(fontSize * 0.04);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(textState.text, textState.xFrac * outW, textState.yFrac * outH);
    }

    // toDataURL returns "data:image/png;base64,<data>" — strip the prefix.
    const dataUrl = offscreen.toDataURL("image/png");
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    onExport(base64);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Live preview canvas */}
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={previewH}
        className="rounded-lg"
        style={{
          width: PREVIEW_WIDTH,
          height: previewH,
          cursor: dragging ? "grabbing" : "grab",
          boxShadow: "var(--shadow)",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Text input */}
      <input
        value={textState.text}
        onChange={(e) => setTextState((prev) => ({ ...prev, text: e.target.value }))}
        placeholder="Add text overlay (optional)"
        className="w-full rounded-md p-2 text-sm"
        style={{
          border: "1px solid var(--border-hi)",
          background: "var(--surface-hi)",
          color: "var(--text-primary)",
        }}
      />

      {/* Font size slider — flanked by small/large "A" so the control reads as
          a text-size control rather than an abstract percentage. */}
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap" style={{ color: "var(--text-dim)", fontSize: 12 }}>
          A
        </span>
        <input
          type="range"
          min="20"
          max="120"
          value={Math.round(textState.sizeFrac * 1000)}
          onChange={(e) =>
            setTextState((prev) => ({
              ...prev,
              sizeFrac: parseInt(e.target.value, 10) / 1000,
            }))
          }
          className="flex-1"
        />
        <span className="whitespace-nowrap" style={{ color: "var(--text-dim)", fontSize: 22 }}>
          A
        </span>
      </div>

      <p className="text-xs" style={{ color: "var(--text-dim)" }}>
        Drag on the image to reposition text.
      </p>

      {/* Export / Save trigger */}
      <button
        onClick={handleExport}
        className="w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-colors hover:opacity-90"
        style={{ background: "var(--gold)", color: "var(--bg)" }}
      >
        Save to library →
      </button>
    </div>
  );
}
