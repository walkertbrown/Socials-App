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
import { CaptionsSection } from "@/components/compose/captions-section";
import { useCaptionDraft, type Platform } from "@/components/compose/use-caption-draft";
import { VideoModeSection } from "@/components/compose/video-mode-section";
import { centralToUtcIso } from "@/lib/time";
import { PIN, makeItems, mergeTags } from "@/lib/compose-helpers";

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
  // Per-platform hashtag selections — Instagram and Facebook keep separate sets.
  const [selectedTags, setSelectedTags] = useState<Record<Platform, string[]>>({
    facebook: [],
    instagram: [],
  });
  const [sharedWhen, setSharedWhen] = useState("");
  const [delivery, setDelivery] = useState<"auto" | "reminder">("auto");
  const [items, setItems] = useState<PlatformItem[]>(makeItems("", "auto"));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Per-platform captions (Instagram + Facebook), their raw AI drafts, and the
  // per-platform "Draft with AI" call. Tags stripped from a draft seed the panel.
  const captionDraft = useCaptionDraft({
    getPhotoId: () => selectedIds[0],
    getIntent: () => intent.trim(),
    onSeedTags: (platform, tags) =>
      setSelectedTags((prev) => ({ ...prev, [platform]: mergeTags(prev[platform], tags) })),
    onError: setMsg,
  });

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

  async function schedule() {
    if (mediaMode === "graphic" && !selectedGraphicId) return setMsg("Pick a saved graphic first.");
    if (mediaMode === "photo" && selectedIds.length === 0) return setMsg("Pick a photo or video first.");
    if (!items.length) return setMsg("Pick at least one platform.");
    if (items.some((i) => !i.scheduled_at)) return setMsg("Set a time for each platform.");
    // Every selected platform needs its own caption — she never posts without one.
    const missing = items.find((i) => !captionDraft.captions[i.platform as Platform]?.trim());
    if (missing) {
      return setMsg(
        `Add a ${missing.platform === "facebook" ? "Facebook" : "Instagram"} caption before scheduling.`
      );
    }
    setSaving(true); setMsg(null);
    try {
      const postGroupId = crypto.randomUUID();
      const mediaType = mediaMode === "graphic" ? "graphic" : isVideo ? "video" : isCarousel ? "carousel" : "image";
      const mediaId = mediaMode === "graphic" ? selectedGraphicId! : selectedIds[0];

      // Append each platform's OWN tag set to its caption body.
      // Pin is always first; that platform's selected tags follow (space-separated).
      const withTags = (platform: Platform, body: string) => {
        const tagLine = [PIN, ...selectedTags[platform]].join(" ");
        return body.trim() ? `${body.trim()}\n\n${tagLine}` : tagLine;
      };

      const payload = {
        photo_id: mediaId,
        ...(isCarousel ? { photo_ids: selectedIds } : {}),
        media_type: mediaType,
        post_group_id: postGroupId,
        items: items.map((item) => ({
          platform: item.platform,
          scheduled_at: centralToUtcIso(item.scheduled_at),
          delivery: item.delivery,
          caption: withTags(item.platform as Platform, captionDraft.captions[item.platform as Platform] ?? ""),
          ai_draft: captionDraft.aiDrafts[item.platform as Platform] ?? undefined,
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

        {/* Captions + hashtags — an independent block per platform (IG + FB) */}
        <CaptionsSection
          captions={captionDraft.captions}
          drafting={captionDraft.drafting}
          selectedTags={selectedTags}
          activePlatforms={new Set(items.map((i) => i.platform))}
          canDraft={mediaMode === "photo" && selectedIds.length > 0}
          stepNumber={captionStepNum}
          provenTags={provenTags}
          photoId={selectedIds[0] ?? null}
          onChange={captionDraft.setCaption}
          onDraft={captionDraft.draft}
          onTagsChange={(platform, tags) =>
            setSelectedTags((prev) => ({ ...prev, [platform]: tags }))
          }
        />

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
