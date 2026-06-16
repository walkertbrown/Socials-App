"use client";

// Shows a single output image thumbnail with a download button.

interface OutputCardProps {
  base64Png: string;
  filename: string;
  label: string;
}

export function OutputCard({ base64Png, filename, label }: OutputCardProps) {
  function download() {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${base64Png}`;
    link.download = filename;
    link.click();
  }

  return (
    <div className="flex flex-col gap-2 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${base64Png}`}
        alt={label}
        className="w-full h-auto rounded border border-zinc-200 object-contain max-h-64"
      />
      <p className="text-xs text-zinc-500 text-center">{label}</p>
      <button
        type="button"
        onClick={download}
        className="text-xs px-3 py-1 rounded bg-[#0f3d3e] text-white hover:bg-[#0f3d3e]/80 transition-colors"
      >
        Download
      </button>
    </div>
  );
}
