"use client";

// Sub-component: a single draggable horizontal cut line.
// Dragging updates its Y percent position via onMove; onRemove deletes it.

interface CutLineProps {
  yPercent: number;
  index: number;
  onMove: (index: number, newYPercent: number) => void;
  onRemove: (index: number) => void;
}

export function CutLine({ yPercent, index, onMove, onRemove }: CutLineProps) {
  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const container = (e.currentTarget as HTMLElement).closest(
      "[data-cut-container]"
    ) as HTMLElement | null;
    if (!container) return;

    function onMouseMove(ev: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      const rawY = ((ev.clientY - rect.top) / rect.height) * 100;
      const clamped = Math.max(1, Math.min(99, rawY));
      onMove(index, clamped);
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      style={{ top: `${yPercent}%`, transform: "translateY(-50%)" }}
      className="absolute left-0 right-0 flex items-center cursor-ns-resize z-10"
      onMouseDown={handleMouseDown}
    >
      <div className="flex-1 h-0.5 bg-red-400 opacity-80" />
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-400 text-white text-xs leading-none hover:bg-red-600 select-none"
        aria-label="Remove cut"
      >
        x
      </button>
    </div>
  );
}
