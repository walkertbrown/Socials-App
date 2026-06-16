"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import type { Photo, Graphic } from "@/lib/types";
import { PhotoPicker } from "@/components/photo-picker";
import { PlatformSchedule, type PlatformItem } from "@/components/platform-schedule";
import { centralToUtcIso } from "@/lib/time";

const QUICK_TAGS = ["staff", "cocktails", "food", "patio", "events", "wine"];

// Build the initial items array (both platforms, shared time, not overridden).
function makeItems(when: string, delivery: "auto" | "reminder"): PlatformItem[] {
  return ["instagram", "facebook"].map((p) => ({
    platform: p,
    scheduled_at: when,
    delivery,
    overridden: false,
  }));
}

export function ComposeClient({
  photos,
  graphics = [],
  preselectedGraphicId = null,
  userEmail = "",
}: {
  photos: Photo[];
  graphics?: Graphic[];
  preselectedGraphicId?: string | null;
  userEmail?: string;
}) {
  const router = useRouter();
  // When a graphic is selected, we track its id here instead of a photo id.
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(preselectedGraphicId);
  const [selected, setSelected] = useState<string | null>(null);

  // If a graphicId was passed from /create, default to "graphic" media mode.
  const [mediaMode, setMediaMode] = useState<"photo" | "graphic">(
    preselectedGraphicId ? "graphic" : "photo"
  );

  // Sync if the preselected graphic changes (e.g. navigation).
  useEffect(() => {
    if (preselectedGraphicId) {
      setSelectedGraphicId(preselectedGraphicId);
      setMediaMode("graphic");
    }
  }, [preselectedGraphicId]);
  const [intent, setIntent] = useState("");
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [caption, setCaption] = useState("");
  // aiDraft holds the exact AI-generated text. It's set once on "Draft with AI"
  // and never overwritten by her edits — so we can diff draft vs final later.
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sharedWhen, setSharedWhen] = useState("");
  // ONE auto/remind toggle for the whole post.
  const [delivery, setDelivery] = useState<"auto" | "reminder">("auto");
  const [items, setItems] = useState<PlatformItem[]>(makeItems("", "auto"));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selectedPhoto = photos.find((p) => p.id === selected);
  const isVideo = selectedPhoto?.category === "videos";
  const selectedGraphic = graphics.find((g) => g.id === selectedGraphicId);

  // When a video is selected, default delivery to auto (Reel); user can override.
  // We don't auto-flip if they've already chosen — only on fresh selection.
  const handleSelect = useCallback(
    (id: string | null) => {
      setSelected(id);
      if (id) {
        const photo = photos.find((p) => p.id === id);
        const defaultDelivery = photo?.category === "videos" ? "auto" : "auto";
        setDelivery(defaultDelivery);
        setItems((prev) => prev.map((item) => ({ ...item, delivery: defaultDelivery })));
      }
    },
    [photos]
  );

  // Shared time change: only update items that have NOT been individually overridden.
  function handleSharedWhenChange(when: string) {
    setSharedWhen(when);
    setItems((prev) =>
      prev.map((item) => (item.overridden ? item : { ...item, scheduled_at: when }))
    );
  }

  // Per-platform override: mark as overridden so shared changes don't clobber it.
  function handleItemChange(platform: string, when: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.platform === platform ? { ...item, scheduled_at: when, overridden: true } : item
      )
    );
  }

  // Toggle a platform on/off.
  function handleTogglePlatform(platform: string) {
    setItems((prev) => {
      const exists = prev.find((i) => i.platform === platform);
      if (exists) {
        // Must keep at least one platform.
        if (prev.length <= 1) return prev;
        return prev.filter((i) => i.platform !== platform);
      }
      return [
        ...prev,
        { platform, scheduled_at: sharedWhen, delivery, overridden: false },
      ];
    });
  }

  // Delivery toggle change: update all items.
  function handleDeliveryChange(d: "auto" | "reminder") {
    setDelivery(d);
    setItems((prev) => prev.map((item) => ({ ...item, delivery: d })));
  }

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
        body: JSON.stringify({ photoId: selected, intent: intent.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      // Store draft separate from caption so edits don't overwrite the AI original.
      setAiDraft(d.caption);
      setCaption(d.caption);
    } catch {
      setMsg("Couldn't draft a caption — try again.");
    }
    setDrafting(false);
  }

  async function schedule() {
    // For graphic mode, require a graphic selection.
    if (mediaMode === "graphic" && !selectedGraphicId) {
      return setMsg("Pick a saved graphic first.");
    }
    if (mediaMode === "photo" && !selected) return setMsg("Pick a photo or video first.");
    if (!items.length) return setMsg("Pick at least one platform.");
    if (items.some((i) => !i.scheduled_at)) return setMsg("Set a time for each platform.");
    setSaving(true);
    setMsg(null);
    try {
      const postGroupId = crypto.randomUUID();
      const mediaType = mediaMode === "graphic" ? "graphic" : isVideo ? "video" : "image";
      const mediaId = mediaMode === "graphic" ? selectedGraphicId! : selected!;
      // Build one item per platform.
      const payload = {
        photo_id: mediaId,
        caption,
        // Send the original AI draft so it can be persisted alongside the final
        // caption — the diff is the learning signal for future drafts.
        ai_draft: aiDraft ?? undefined,
        media_type: mediaType,
        post_group_id: postGroupId,
        items: items.map((item) => ({
          platform: item.platform,
          scheduled_at: centralToUtcIso(item.scheduled_at),
          delivery: item.delivery,
        })),
      };
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={userEmail} />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">New post</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/create" className="text-zinc-500 underline">Create graphic</Link>
          <Link href="/board" className="text-zinc-500 underline">← Board</Link>
        </div>
      </div>

      {/* Media mode: photo/video vs saved graphic */}
      <section>
        <p className="mb-2 text-sm font-medium text-zinc-700">1. What are you posting?</p>
        <div className="flex gap-2">
          {(["photo", "graphic"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMediaMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                mediaMode === m ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {m === "photo" ? "Photo or Video" : "Saved Graphic"}
            </button>
          ))}
        </div>
      </section>

      {/* Graphic picker */}
      {mediaMode === "graphic" && (
        <section>
          <p className="mb-2 text-sm font-medium text-zinc-700">2. Pick a saved graphic</p>
          {graphics.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No saved graphics yet.{" "}
              <Link href="/create" className="underline">Create one →</Link>
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {graphics.map((g) => {
                const sb = g.png_path
                  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/graphics/${g.png_path}`
                  : null;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGraphicId(g.id)}
                    className={`relative aspect-square overflow-hidden rounded-md border-2 ${
                      selectedGraphicId === g.id ? "border-blue-600" : "border-transparent"
                    }`}
                  >
                    {sb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sb} alt="Graphic" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-zinc-100 text-xs text-zinc-500">
                        Graphic
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {g.size}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {selectedGraphic && (
            <p className="mt-1 text-xs text-zinc-500">
              Selected: {selectedGraphic.size} graphic from{" "}
              {new Date(selectedGraphic.created_at).toLocaleDateString()}
            </p>
          )}
        </section>
      )}

      {/* Photo/video sections — only shown in photo mode */}
      {mediaMode === "photo" && (
        <>
          {/* Intent search */}
          <section>
            <p className="mb-2 text-sm font-medium text-zinc-700">2. What do you want to post about?</p>
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
            <p className="mt-2 text-xs text-zinc-400">Optional — leave blank to browse everything.</p>
          </section>

          {/* Photo / video picker */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">3. Pick a photo or video</p>
              {matchedIds !== null && (
                <button onClick={clearSearch} className="text-xs text-zinc-500 underline">
                  Showing matches{intent.trim() ? ` for "${intent.trim()}"` : ""} · clear
                </button>
              )}
            </div>
            <PhotoPicker photos={photos} selectedId={selected} onSelect={handleSelect} matchedIds={matchedIds} />
          </section>
        </>
      )}

      {/* Video preview */}
      {isVideo && selected && (
        <section>
          <p className="mb-2 text-sm font-medium text-zinc-700">Preview</p>
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

      {/* Caption — section number is dynamic based on media mode */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">
            {mediaMode === "graphic" ? "2" : "4"}. Caption
          </p>
          {/* Draft with AI only available for photo posts (needs photo context) */}
          <button
            onClick={draft}
            disabled={mediaMode !== "photo" || !selected || drafting}
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

      {/* 4+5. Platform + time (per-platform) */}
      <PlatformSchedule
        items={items}
        sharedWhen={sharedWhen}
        onSharedWhenChange={handleSharedWhenChange}
        onItemChange={handleItemChange}
        onTogglePlatform={handleTogglePlatform}
        isVideo={isVideo}
      />

      {/* Video delivery toggle (whole-post, not per-platform) */}
      {isVideo && selected && (
        <section>
          <p className="mb-2 text-sm font-medium text-zinc-700">Video publish mode</p>
          <div className="flex gap-2">
            {(["auto", "reminder"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDeliveryChange(d)}
                className={`rounded-full px-4 py-1.5 text-sm ${
                  delivery === d ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {d === "auto" ? "Post it for me (Reel)" : "Remind me"}
              </button>
            ))}
          </div>
          {delivery === "reminder" && (
            <p className="mt-1 text-xs text-zinc-500">
              We will ping your phone at the scheduled time so you can add trending audio and post it yourself.
            </p>
          )}
        </section>
      )}

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <button
        onClick={schedule}
        disabled={saving}
        className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Scheduling…" : "Schedule"}
      </button>
    </div>
    </div>
  );
}
