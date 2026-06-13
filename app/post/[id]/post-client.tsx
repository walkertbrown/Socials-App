"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  id: string;
  photoId: string;
  caption: string;
  platforms: string[];
  done: boolean;
}

// Three taps to post: save the video, copy the caption, open Instagram. Then she
// confirms with "Mark as posted" (the app can't see the manual post itself).
export function PostClient({ id, photoId, caption, platforms, done }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [posted, setPosted] = useState(done);
  const [saving, setSaving] = useState(false);

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — she can still select the text */
    }
  }

  async function markPosted() {
    setSaving(true);
    await fetch(`/api/posts/${id}/posted`, { method: "POST" }).catch(() => {});
    setPosted(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Time to post your video 🎬</h1>
      <p className="text-sm text-zinc-500">For {platforms.join(" + ")}.</p>

      {/* Watch it right here — streamed from Drive through the app. Sized to the
          clip's own aspect ratio so vertical Reels aren't letterboxed. */}
      <div className="flex justify-center">
        <video
          src={`/api/videos/${photoId}/download`}
          poster={`/api/thumb/${photoId}`}
          controls
          playsInline
          preload="metadata"
          className="max-h-[70vh] max-w-full rounded-lg bg-black"
        />
      </div>

      <a
        href={`/api/videos/${photoId}/download?download=1`}
        className="rounded-md bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white"
      >
        1. Save video to phone
      </a>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">2. Caption</span>
          <button onClick={copyCaption} className="text-xs text-blue-600 underline">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <textarea
          readOnly
          value={caption}
          rows={5}
          className="w-full rounded-md border border-zinc-300 p-2 text-sm"
        />
      </div>

      <a
        href="https://www.instagram.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-3 text-center text-sm font-medium text-white"
      >
        3. Open Instagram → add trending audio + paste caption
      </a>

      {posted ? (
        <div className="rounded-md bg-emerald-50 p-3 text-center text-sm text-emerald-700">
          Marked as posted ✓ <Link href="/posts" className="underline">Back to posts</Link>
        </div>
      ) : (
        <button
          onClick={markPosted}
          disabled={saving}
          className="rounded-md bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "✓ Mark as posted"}
        </button>
      )}

      <Link href="/posts" className="text-center text-xs text-zinc-400 underline">
        ← All posts
      </Link>
    </div>
  );
}
