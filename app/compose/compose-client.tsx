"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Photo } from "@/lib/types";
import { PhotoPicker } from "@/components/photo-picker";
import { centralToUtcIso } from "@/lib/time";

// One-tap shortcuts that fill the intent box and search immediately.
const QUICK_TAGS = ["staff", "cocktails", "food", "patio", "events", "wine"];

export function ComposeClient({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [caption, setCaption] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  // A video gets the "reminder" treatment: we ping her phone at post time instead
  // of auto-publishing, so she can add trending audio in Instagram herself.
  const selectedPhoto = photos.find((p) => p.id === selected);
  const isVideo = selectedPhoto?.category === "videos";

  async function findPhotos(term?: string) {
    const query = (term ?? intent).trim();
    if (term !== undefined) setIntent(term);
    if (!query) return setMatchedIds(null);
    setSearching(true);
    setMsg(null);
    try {
      const res = await fetch("/api/posts/match-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: query }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setMatchedIds(d.ids ?? []);
      setSelected(null);
    } catch {
      setMsg("Couldn't search photos — try again.");
    }
    setSearching(false);
  }

  function clearSearch() {
    setIntent("");
    setMatchedIds(null);
  }

  async function draft() {
    if (!selected) return setMsg("Pick a photo first.");
    setDrafting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/posts/draft-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Hand the intent to the caption writer so it's aimed at what she wants.
        body: JSON.stringify({ photoId: selected, intent: intent.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setCaption(d.caption);
    } catch {
      setMsg("Couldn't draft a caption — try again.");
    }
    setDrafting(false);
  }

  async function schedule() {
    if (!selected) return setMsg("Pick a photo first.");
    if (!platforms.length) return setMsg("Pick at least one platform.");
    if (!when) return setMsg("Pick a date and time.");
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_id: selected,
          caption,
          platforms,
          scheduled_at: centralToUtcIso(when),
          delivery: isVideo ? "reminder" : "auto",
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Couldn't schedule.");
      }
      router.push("/posts");
    } catch (e) {
      setMsg((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">New post</h1>
        <Link href="/board" className="text-sm text-zinc-500 underline">
          ← Board
        </Link>
      </div>

      <section>
        <p className="mb-2 text-sm font-medium text-zinc-700">1. What do you want to post about?</p>
        <div className="flex gap-2">
          <input
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && findPhotos()}
            placeholder="e.g. a post about the staff, this weekend, the BBQ shrimp…"
            className="w-full rounded-md border border-zinc-300 p-2 text-sm"
          />
          <button
            onClick={() => findPhotos()}
            disabled={searching}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-40"
          >
            {searching ? "Finding…" : "Find photos"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => findPhotos(t)}
              className="rounded-full bg-zinc-100 px-3 py-1 text-xs capitalize text-zinc-700 hover:bg-zinc-200"
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-400">Optional — leave blank to just browse everything below.</p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">2. Pick a photo</p>
          {matchedIds !== null && (
            <button onClick={clearSearch} className="text-xs text-zinc-500 underline">
              Showing matches{intent.trim() ? ` for “${intent.trim()}”` : ""} · clear
            </button>
          )}
        </div>
        <PhotoPicker photos={photos} selectedId={selected} onSelect={setSelected} matchedIds={matchedIds} />
      </section>

      {isVideo && selected && (
        <section>
          <p className="mb-2 text-sm font-medium text-zinc-700">Preview</p>
          {/* Plays straight from Drive (streamed through the app). Sized to the clip's
              own aspect ratio — vertical clips stay vertical, no letterboxing. */}
          <div className="flex justify-center">
            <video
              key={selected}
              src={`/api/videos/${selected}/download`}
              controls
              playsInline
              preload="metadata"
              className="max-h-[60vh] max-w-full rounded-md bg-black"
            />
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">3. Caption</p>
          <button
            onClick={draft}
            disabled={!selected || drafting}
            className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-40"
          >
            {drafting ? "Writing…" : "Draft with AI"}
          </button>
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          placeholder="Write a caption, or click Draft with AI…"
          className="w-full rounded-md border border-zinc-300 p-2 text-sm"
        />
      </section>

      <section>
        <p className="mb-2 text-sm font-medium text-zinc-700">4. Where</p>
        <div className="flex gap-2">
          {["instagram", "facebook"].map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${
                platforms.includes(p) ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 text-sm font-medium text-zinc-700">5. When (Central Time)</p>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-md border border-zinc-300 p-2 text-sm"
        />
      </section>

      {isVideo && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          📱 This is a video — at this time we’ll <strong>ping your phone</strong> to post it yourself
          (so you can add trending audio). It won’t auto-publish.
        </p>
      )}

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <button
        onClick={schedule}
        disabled={saving}
        className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Scheduling…" : isVideo ? "Schedule reminder" : "Schedule post"}
      </button>
    </div>
  );
}
