"use client";

// CaptionsSection — the two platform caption boxes stacked under one heading.
// Instagram first (it's the hashtag-heavy platform), Facebook second.

import { CaptionBox } from "./caption-box";
import type { Platform } from "./use-caption-draft";

const ORDER: Platform[] = ["instagram", "facebook"];
const LABEL: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook" };

interface Props {
  captions: Record<Platform, string>;
  drafting: Record<Platform, boolean>;
  activePlatforms: Set<string>; // which platforms are actually selected to post
  canDraft: boolean; // photo mode + a photo is selected
  stepNumber: number;
  onChange: (platform: Platform, value: string) => void;
  onDraft: (platform: Platform) => void;
}

export function CaptionsSection({
  captions,
  drafting,
  activePlatforms,
  canDraft,
  stepNumber,
  onChange,
  onDraft,
}: Props) {
  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {stepNumber}. Captions
      </p>
      {ORDER.map((p) => (
        <CaptionBox
          key={p}
          label={LABEL[p]}
          caption={captions[p]}
          drafting={drafting[p]}
          canDraft={canDraft}
          active={activePlatforms.has(p)}
          onChange={(v) => onChange(p, v)}
          onDraft={() => onDraft(p)}
        />
      ))}
    </section>
  );
}
