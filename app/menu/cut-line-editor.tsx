"use client";

// Interactive preview editor: click to place cut lines, drag to reposition,
// x to remove. Section labels are shown between lines.

import { useState, useCallback } from "react";
import { CutLine } from "./cut-line";

interface CutLineEditorProps {
  previewSrc: string;
  onChange: (cuts: number[]) => void;
}

export function CutLineEditor({ previewSrc, onChange }: CutLineEditorProps) {
  const [cuts, setCuts] = useState<number[]>([]);

  // Sort helper — keeps cuts in ascending order and notifies parent.
  const commit = useCallback(
    (next: number[]) => {
      const sorted = [...next].sort((a, b) => a - b);
      setCuts(sorted);
      onChange(sorted);
    },
    [onChange]
  );

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    commit([...cuts, yPercent]);
  }

  function handleMove(index: number, newY: number) {
    const next = cuts.map((y, i) => (i === index ? newY : y));
    // Keep unsorted during drag so index stays stable; commit will sort.
    setCuts(next);
    onChange([...next].sort((a, b) => a - b));
  }

  function handleRemove(index: number) {
    commit(cuts.filter((_, i) => i !== index));
  }

  // Section labels: boundaries are 0%, each cut, 100%.
  const boundaries = [0, ...cuts, 100];
  const labels = boundaries.slice(0, -1).map((start, i) => ({
    midY: (start + boundaries[i + 1]) / 2,
    label: `Section ${i + 1}`,
  }));

  return (
    <div
      data-cut-container
      className="relative w-full cursor-crosshair select-none"
      onClick={handleImageClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewSrc}
        alt="Menu preview"
        className="w-full h-auto block pointer-events-none"
        draggable={false}
      />

      {/* Section labels */}
      {labels.map(({ midY, label }) => (
        <div
          key={label}
          style={{ top: `${midY}%`, transform: "translateY(-50%)", color: "var(--red)", background: "rgba(0,0,0,0.55)" }}
          className="absolute left-2 pointer-events-none text-xs font-semibold px-1 rounded"
        >
          {label}
        </div>
      ))}

      {/* Cut lines (sorted order — index here matches sorted cuts array) */}
      {cuts.map((y, i) => (
        <CutLine
          key={i}
          yPercent={y}
          index={i}
          onMove={handleMove}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}
