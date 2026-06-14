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
  // Whether this post is pinned as a voice-corpus exemplar for future AI drafts.
  isExemplar?: boolean;
}

// Three taps to post: save the video, copy the caption, open Instagram. Then she
// confirms with "Mark as posted" (the app can't see the manual post itself).
export function PostClient({ id, photoId, caption, platforms, done, isExemplar = false }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [posted, setPosted] = useState(done);
  const [saving, setSaving] = useState(false);
  // Exemplar toggle: ⭐ pins this post into the AI voice corpus permanently.
  const [exemplar, setExemplar] = useState(isExemplar);
  const [exemplarSaving, setExemplarSaving] = useState(false);

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

  // Toggle the exemplar pin.  Exemplar posts are always included in the AI voice
  // corpus so future drafts learn from captions she considers best-in-class.
  async function toggleExemplar() {
    setExemplarSaving(true);
    const next = !exemplar;
    try {
      await fetch(`/api/posts/${id}/exemplar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exemplar: next }),
      });
      setExemplar(next);
    } catch {
      /* non-fatal — the star just doesn't flip */
    }
    setExemplarSaving(false);
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

      {/* Exemplar toggle: pin this caption into the AI voice corpus */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleExemplar}
          disabled={exemplarSaving}
          title={exemplar ? "Remove from AI voice examples" : "Pin as AI voice example"}
          className={`text-xl disabled:opacity-40 ${exemplar ? "text-yellow-400" : "text-zinc-300"}`}
        >
          ★
        </button>
        <span className="text-xs text-zinc-500">
          {exemplar
            ? "Pinned as a voice example — AI will always use this caption style"
            : "Pin as a voice example for future AI drafts"}
        </span>
      </div>

      <Link href="/posts" className="text-center text-xs text-zinc-400 underline">
        ← All posts
      </Link>
    </div>
  );
}
