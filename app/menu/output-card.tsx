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
        className="w-full h-auto rounded object-contain max-h-64"
        style={{ border: "1px solid var(--border)" }}
      />
      <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <button
        type="button"
        onClick={download}
        className="text-xs px-3 py-1 rounded font-medium transition-colors hover:opacity-90"
        style={{ background: "var(--gold)", color: "var(--bg)" }}
      >
        Download
      </button>
    </div>
  );
}
