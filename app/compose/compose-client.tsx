"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Photo } from "@/lib/types";
import { PhotoPicker } from "@/components/photo-picker";
import { centralToUtcIso } from "@/lib/time";

export function ComposeClient({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  async function draft() {
    if (!selected) return setMsg("Pick a photo first.");
    setDrafting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/posts/draft-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: selected }),
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
        body: JSON.stringify({ photo_id: selected, caption, platforms, scheduled_at: centralToUtcIso(when) }),
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
        <p className="mb-2 text-sm font-medium text-zinc-700">1. Pick a photo</p>
        <PhotoPicker photos={photos} selectedId={selected} onSelect={setSelected} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">2. Caption</p>
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
        <p className="mb-2 text-sm font-medium text-zinc-700">3. Where</p>
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
        <p className="mb-2 text-sm font-medium text-zinc-700">4. When (Central Time)</p>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-md border border-zinc-300 p-2 text-sm"
        />
      </section>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <button
        onClick={schedule}
        disabled={saving}
        className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Scheduling…" : "Schedule post"}
      </button>
    </div>
  );
}
