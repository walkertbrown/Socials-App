"use client";

// CaptionsSection — the two per-platform compose blocks under one heading.
// Each block (Instagram first, then Facebook) holds its own caption AND its own
// hashtag set, so the platforms stay fully independent.

import { PlatformComposeBlock } from "./platform-compose-block";
import type { Platform } from "./use-caption-draft";

const ORDER: Platform[] = ["instagram", "facebook"];
const LABEL: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook" };

interface Props {
  captions: Record<Platform, string>;
  drafting: Record<Platform, boolean>;
  selectedTags: Record<Platform, string[]>;
  activePlatforms: Set<string>; // which platforms are actually selected to post
  canDraft: boolean; // photo mode + a photo is selected
  stepNumber: number;
  provenTags: string[];
  photoId: string | null;
  onChange: (platform: Platform, value: string) => void;
  onDraft: (platform: Platform) => void;
  onTagsChange: (platform: Platform, tags: string[]) => void;
}

export function CaptionsSection({
  captions,
  drafting,
  selectedTags,
  activePlatforms,
  canDraft,
  stepNumber,
  provenTags,
  photoId,
  onChange,
  onDraft,
  onTagsChange,
}: Props) {
  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {stepNumber}. Captions &amp; hashtags
      </p>
      {ORDER.map((p) => (
        <PlatformComposeBlock
          key={p}
          label={LABEL[p]}
          active={activePlatforms.has(p)}
          canDraft={canDraft}
          caption={captions[p]}
          drafting={drafting[p]}
          onCaptionChange={(v) => onChange(p, v)}
          onDraft={() => onDraft(p)}
          provenTags={provenTags}
          photoId={photoId}
          selectedTags={selectedTags[p]}
          onSelectedTagsChange={(tags) => onTagsChange(p, tags)}
        />
      ))}
    </section>
  );
}
