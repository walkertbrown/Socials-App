"use client";
// New post composer — sub-screen of Studio (back arrow, no bottom tab here).
// Wraps in AppShell so the bottom tab bar is still visible for navigation.

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import type { Photo, Graphic } from "@/lib/types";
import { PhotoPicker } from "@/components/photo-picker";
import { PlatformSchedule, type PlatformItem } from "@/components/platform-schedule";
import { MediaModePicker } from "@/components/compose/media-mode-picker";
import { IntentSearch } from "@/components/compose/intent-search";
import { CaptionBox } from "@/components/compose/caption-box";
import { HashtagPanel } from "@/components/compose/hashtag-panel";
import { VideoModeSection } from "@/components/compose/video-mode-section";
import { centralToUtcIso } from "@/lib/time";
import { PIN, makeItems, splitCaptionAndTags } from "@/lib/compose-helpers";

export function ComposeClient({
  photos,
  graphics = [],
  provenTags = [],
  preselectedGraphicId = null,
  preselectedPhotoIds = [],
  userEmail: _userEmail = "",
}: {
  photos: Photo[];
  graphics?: Graphic[];
  provenTags?: string[];
  preselectedGraphicId?: string | null;
  preselectedPhotoIds?: string[];
  userEmail?: string;
}) {
  const router = useRouter();
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(preselectedGraphicId);
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedPhotoIds);
  const [mediaMode, setMediaMode] = useState<"photo" | "graphic">(
    preselectedGraphicId ? "graphic" : "photo"
  );

  useEffect(() => {
    if (preselectedGraphicId) { setSelectedGraphicId(preselectedGraphicId); setMediaMode("graphic"); }
  }, [preselectedGraphicId]);

  const [intent, setIntent] = useState("");
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [sharedWhen, setSharedWhen] = useState("");
  const [delivery, setDelivery] = useState<"auto" | "reminder">("auto");
  const [items, setItems] = useState<PlatformItem[]>(makeItems("", "auto"));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const primaryPhoto = photos.find((p) => p.id === selectedIds[0]);
  const isVideo = primaryPhoto?.category === "videos";
  const isCarousel = selectedIds.length > 1;

  const handleSelect = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    if (ids.length === 1) {
      setDelivery("auto");
      setItems((prev) => prev.map((item) => ({ ...item, delivery: "auto" })));
    }
  }, []);

  function handleSharedWhenChange(when: string) {
    setSharedWhen(when);
    setItems((prev) => prev.map((item) => (item.overridden ? item : { ...item, scheduled_at: when })));
  }

  function handleItemChange(platform: string, when: string) {
    setItems((prev) => prev.map((item) =>
      item.platform === platform ? { ...item, scheduled_at: when, overridden: true } : item
    ));
  }

  function handleSetPlatforms(platforms: string[]) {
    // Set platforms to exactly this selection (Both / IG / FB), keeping existing times.
    setItems((prev) =>
      platforms.map((p) => prev.find((i) => i.platform === p)
        ?? { platform: p, scheduled_at: sharedWhen, delivery, overridden: false }));
  }

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
      setSelectedIds([]);
    } catch { setMsg("Couldn't search photos — try again."); }
    setSearching(false);
  }

  async function draft() {
    if (!selectedIds[0]) return setMsg("Pick a photo first.");
    setDrafting(true); setMsg(null);
    try {
      const res = await fetch("/api/posts/draft-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: selectedIds[0], intent: intent.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");

      // Strip hashtags from the AI caption and seed them into the hashtag panel.
      // The caption box stays clean; tags aren't duplicated.
      const { body, tags } = splitCaptionAndTags(d.caption);
      setCaption(body);
      setAiDraft(d.caption); // preserve original for learning loop

      // Merge new AI tags into existing selected tags (dedupe, case-insensitive).
      setSelectedTags((prev) => {
        const existing = new Set(prev.map((t) => t.toLowerCase()));
        const merged = [...prev];
        for (const tag of tags) {
          if (!existing.has(tag) && tag !== PIN.toLowerCase()) {
            merged.push(tag);
            existing.add(tag);
          }
        }
        return merged;
      });
    } catch { setMsg("Couldn't draft a caption — try again."); }
    setDrafting(false);
  }

  async function schedule() {
    if (mediaMode === "graphic" && !selectedGraphicId) return setMsg("Pick a saved graphic first.");
    if (mediaMode === "photo" && selectedIds.length === 0) return setMsg("Pick a photo or video first.");
    if (!items.length) return setMsg("Pick at least one platform.");
    if (items.some((i) => !i.scheduled_at)) return setMsg("Set a time for each platform.");
    setSaving(true); setMsg(null);
    try {
      const postGroupId = crypto.randomUUID();
      const mediaType = mediaMode === "graphic" ? "graphic" : isVideo ? "video" : isCarousel ? "carousel" : "image";
      const mediaId = mediaMode === "graphic" ? selectedGraphicId! : selectedIds[0];

      // Merge caption + selected tags into the final caption string.
      // Pin is always first; user-selected tags follow (space-separated).
      const tagLine = [PIN, ...selectedTags].join(" ");
      const finalCaption = caption.trim()
        ? `${caption.trim()}\n\n${tagLine}`
        : tagLine;

      const payload = {
        photo_id: mediaId,
        ...(isCarousel ? { photo_ids: selectedIds } : {}),
        caption: finalCaption,
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

  const captionStepNum = mediaMode === "graphic" ? 2 : 4;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pt-6 pb-4">
        {/* Back arrow — this is a sub-screen of Studio */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 self-start text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text-dim)", background: "none", border: "none" }}
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          Studio
        </button>

        <h1 className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)", fontWeight: 500, color: "var(--text-primary)" }}>
          New post
        </h1>

        {/* 1. Media mode + graphic picker */}
        <MediaModePicker
          mediaMode={mediaMode}
          onModeChange={setMediaMode}
          graphics={graphics}
          selectedGraphicId={selectedGraphicId}
          onSelectGraphic={setSelectedGraphicId}
        />

        {/* 2+3. Intent search + photo picker (photo mode only) */}
        {mediaMode === "photo" && (
          <>
            <IntentSearch
              intent={intent}
              searching={searching}
              matchedIds={matchedIds}
              onIntentChange={setIntent}
              onSearch={findPhotos}
              onClear={() => { setIntent(""); setMatchedIds(null); }}
            />
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  3. Pick photo{isCarousel ? `s (${selectedIds.length} selected — carousel)` : " or video"}
                </p>
              </div>
              <PhotoPicker photos={photos} selectedIds={selectedIds} onSelect={handleSelect} matchedIds={matchedIds} multi />
            </section>
          </>
        )}

        {/* Video preview */}
        {isVideo && selectedIds[0] && (
          <section>
            <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Preview</p>
            <video key={selectedIds[0]} src={`/api/videos/${selectedIds[0]}/download`} controls playsInline preload="metadata"
              className="max-h-[60vh] max-w-full rounded bg-black" />
          </section>
        )}

        {/* Caption */}
        <CaptionBox
          caption={caption}
          mediaMode={mediaMode}
          selectedIds={selectedIds}
          drafting={drafting}
          stepNumber={captionStepNum}
          onChange={setCaption}
          onDraft={draft}
        />

        {/* Hashtag panel */}
        <section>
          <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            {captionStepNum + 1}. Hashtags
          </p>
          <HashtagPanel
            provenTags={provenTags}
            photoId={selectedIds[0] ?? null}
            caption={caption}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
          />
        </section>

        <PlatformSchedule items={items} sharedWhen={sharedWhen} onSharedWhenChange={handleSharedWhenChange}
          onItemChange={handleItemChange} onSetPlatforms={handleSetPlatforms} isVideo={isVideo} />

        {isVideo && selectedIds.length === 1 && (
          <VideoModeSection delivery={delivery} onDeliveryChange={handleDeliveryChange} />
        )}

        {msg && <p className="text-sm" style={{ color: "var(--red)" }}>{msg}</p>}

        {/* Full-width teal CTA */}
        <button onClick={schedule} disabled={saving}
          className="btn-teal w-full rounded py-3 text-sm font-medium">
          {saving ? "Scheduling…" : "Schedule post"}
        </button>
      </div>
    </AppShell>
  );
}
