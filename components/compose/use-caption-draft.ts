"use client";

// Holds the two platform captions (Instagram + Facebook), their raw AI drafts
// (for the learning loop), and the per-platform "Draft with AI" call.
//
// Lifted out of compose-client.tsx to keep that file under the 300-line ceiling.
// Each platform drafts independently: clicking "Draft Instagram" only writes the
// Instagram box; clicking "Draft Facebook" only writes the Facebook box.

import { useState } from "react";
import { splitCaptionAndTags } from "@/lib/compose-helpers";

export type Platform = "facebook" | "instagram";

type Strings = Record<Platform, string>;
type Drafts = Record<Platform, string | null>;
type Flags = Record<Platform, boolean>;

interface Options {
  getPhotoId: () => string | undefined;
  getIntent: () => string;
  // The draft strips hashtags out of the AI text; they get seeded into the shared
  // hashtag panel via this callback.
  onSeedTags: (tags: string[]) => void;
  onError: (msg: string | null) => void;
}

export function useCaptionDraft({ getPhotoId, getIntent, onSeedTags, onError }: Options) {
  const [captions, setCaptions] = useState<Strings>({ facebook: "", instagram: "" });
  const [aiDrafts, setAiDrafts] = useState<Drafts>({ facebook: null, instagram: null });
  const [drafting, setDrafting] = useState<Flags>({ facebook: false, instagram: false });

  function setCaption(platform: Platform, value: string) {
    setCaptions((c) => ({ ...c, [platform]: value }));
  }

  async function draft(platform: Platform) {
    const photoId = getPhotoId();
    if (!photoId) return onError("Pick a photo first.");
    setDrafting((d) => ({ ...d, [platform]: true }));
    onError(null);
    try {
      const res = await fetch("/api/posts/draft-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, platform, intent: getIntent() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");

      // Keep the caption box clean (body only); seed the stripped tags into the panel.
      const { body, tags } = splitCaptionAndTags(d.caption);
      setCaption(platform, body);
      setAiDrafts((a) => ({ ...a, [platform]: d.caption })); // raw draft for the learning loop
      onSeedTags(tags);
    } catch {
      onError("Couldn't draft a caption — try again.");
    } finally {
      setDrafting((d) => ({ ...d, [platform]: false }));
    }
  }

  return { captions, aiDrafts, drafting, setCaption, draft };
}
