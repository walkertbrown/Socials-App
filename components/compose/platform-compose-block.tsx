"use client";

// PlatformComposeBlock — one platform's whole writing area: its caption box
// (with its own "Draft" button) plus its own hashtag panel, grouped in a card.
// Rendered once for Instagram and once for Facebook so each platform keeps a
// fully independent caption AND hashtag set.

import { CaptionBox } from "./caption-box";
import { HashtagPanel } from "./hashtag-panel";

interface Props {
  label: string; // "Instagram" | "Facebook"
  active: boolean; // is this platform selected to post?
  canDraft: boolean; // photo mode + a photo is selected
  caption: string;
  drafting: boolean;
  onCaptionChange: (value: string) => void;
  onDraft: () => void;
  // Hashtags for THIS platform.
  provenTags: string[];
  photoId: string | null;
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;
}

export function PlatformComposeBlock({
  label,
  active,
  canDraft,
  caption,
  drafting,
  onCaptionChange,
  onDraft,
  provenTags,
  photoId,
  selectedTags,
  onSelectedTagsChange,
}: Props) {
  return (
    <div
      className="flex flex-col gap-3 rounded-md p-3"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <CaptionBox
        label={label}
        caption={caption}
        drafting={drafting}
        canDraft={canDraft}
        active={active}
        onChange={onCaptionChange}
        onDraft={onDraft}
      />
      {/* Hashtags for this platform — live suggestions read off this caption only. */}
      <div style={{ opacity: active ? 1 : 0.55 }}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Hashtags
        </p>
        <HashtagPanel
          provenTags={provenTags}
          photoId={photoId}
          caption={caption}
          selectedTags={selectedTags}
          onSelectedTagsChange={onSelectedTagsChange}
        />
      </div>
    </div>
  );
}
