"use client";

// HashtagPanel — two-group hashtag picker below the caption box.
//
// Groups:
//   • "Proven for you" — reach-ranked tags from the learning-loop vocab.
//   • "For this post"  — live AI suggestions, debounced from the caption text.
//
// Rules enforced here:
//   • #PelicanClubNOLA pinned first (always selected, always first in output).
//   • Soft nudge at 6 selected; hard cap at 30 (not counting the pin).
//   • Case-insensitive dedupe — pin's display casing wins.
//   • Free-type input.
//
// Cost guards (see plan §Cost guards):
//   • Guard #1: 1200ms debounce before firing the live suggest call.
//   • Guard #2: skip-if-unchanged fingerprint (trim+lower).
//   • Guard #3: min caption length 20 chars before first call.
//   • Guard #4: isFetching in-flight lock — no concurrent calls.

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

const PIN = "#pelicanclubNOLA"; // display casing for the pin
const PIN_LOWER = PIN.toLowerCase();
const SOFT_NUDGE = 6; // warn (but don't block) above this count (excluding pin)
const HARD_CAP = 30; // absolute max selected tags excluding pin
const DEBOUNCE_MS = 1200; // guard #1
const MIN_CAPTION_LEN = 20; // guard #3

interface HashtagPanelProps {
  provenTags: string[]; // "Proven for you" — reach-ranked from server
  photoId: string | null; // needed for the "For this post" AI call
  caption: string; // current caption text — drives the auto-suggest
  selectedTags: string[]; // controlled from parent
  onSelectedTagsChange: (tags: string[]) => void;
}

// Normalise a tag string: lowercase, ensure leading #, strip spaces.
function normalise(raw: string): string {
  const clean = raw.trim().replace(/\s+/g, "").toLowerCase();
  return clean.startsWith("#") ? clean : `#${clean}`;
}

export function HashtagPanel({
  provenTags,
  photoId,
  caption,
  selectedTags,
  onSelectedTagsChange,
}: HashtagPanelProps) {
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false); // guard #4
  const [freeInput, setFreeInput] = useState("");
  const lastFingerprintRef = useRef<string>(""); // guard #2
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The pin is always included first and is not in the user-controlled list.
  // We keep it conceptually separate so the count / cap logic is clean.

  const selectedLower = new Set(selectedTags.map((t) => t.toLowerCase()));

  // ── Auto-suggest (debounced) ────────────────────────────────────────────────

  const fetchSuggestions = useCallback(
    async (captionText: string) => {
      const fingerprint = captionText.trim().toLowerCase();

      // Guard #3: minimum length.
      if (fingerprint.length < MIN_CAPTION_LEN) return;

      // Guard #2: skip if caption hasn't changed since last call.
      if (fingerprint === lastFingerprintRef.current) return;

      // Guard #4: don't fire if a call is already in flight.
      if (isFetching) return;

      if (!photoId) return;

      lastFingerprintRef.current = fingerprint;
      setIsFetching(true);
      try {
        const res = await fetch("/api/hashtags/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: captionText, photoId }),
        });
        if (res.ok) {
          const { tags } = await res.json();
          if (Array.isArray(tags)) {
            // Strip the pin from AI results — it's always present anyway.
            setAiTags(tags.filter((t: string) => t.toLowerCase() !== PIN_LOWER));
          }
        }
      } catch {
        // Silently degrade — suggestions are a best-effort UI aid.
      } finally {
        setIsFetching(false);
      }
    },
    [isFetching, photoId]
  );

  // Debounce the caption changes → auto-suggest trigger (guard #1).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(caption);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [caption]); // eslint-disable-line react-hooks/exhaustive-deps
  // fetchSuggestions intentionally excluded — its reference changes with isFetching,
  // which would reset the debounce timer on every in-flight state update.

  // ── Tag selection helpers ───────────────────────────────────────────────────

  function toggle(raw: string) {
    const norm = normalise(raw);
    if (norm === PIN_LOWER) return; // pin can't be toggled

    const currentLower = new Set(selectedTags.map((t) => t.toLowerCase()));
    if (currentLower.has(norm)) {
      // Deselect.
      onSelectedTagsChange(selectedTags.filter((t) => t.toLowerCase() !== norm));
    } else {
      // Select — enforce hard cap.
      if (selectedTags.length >= HARD_CAP) return;
      onSelectedTagsChange([...selectedTags, norm]);
    }
  }

  function handleFreeInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== " " && e.key !== ",") return;
    e.preventDefault();
    const val = freeInput.trim();
    if (!val) return;
    const norm = normalise(val);
    if (norm.length <= 1) return; // just "#" is invalid
    if (norm !== PIN_LOWER && !selectedLower.has(norm) && selectedTags.length < HARD_CAP) {
      onSelectedTagsChange([...selectedTags, norm]);
    }
    setFreeInput("");
  }

  // ── Chip renderer ───────────────────────────────────────────────────────────

  function TagChip({
    tag,
    selected,
    dimmed,
  }: {
    tag: string;
    selected: boolean;
    dimmed?: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={() => toggle(tag)}
        className="rounded-full px-3 py-1 text-xs transition-colors"
        style={{
          background: selected ? "var(--gold)" : dimmed ? "var(--surface)" : "var(--surface-hi)",
          color: selected ? "var(--on-accent)" : dimmed ? "var(--text-dim)" : "var(--text-secondary)",
          opacity: dimmed ? 0.6 : 1,
        }}
      >
        {tag}
      </button>
    );
  }

  const overSoft = selectedTags.length > SOFT_NUDGE;
  const atCap = selectedTags.length >= HARD_CAP;

  return (
    <section>
      <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {/* Section number changes depending on mode — managed by parent */}
        Hashtags
      </p>

      {/* Selected chip row (pin first, then user-selected, each removable) */}
      {(selectedTags.length > 0) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {/* Pin — always first, not removable */}
          <span
            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs"
            style={{ background: "var(--gold)", color: "var(--on-accent)" }}
          >
            {PIN}
          </span>
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs"
              style={{ background: "var(--gold)", color: "var(--on-accent)" }}
            >
              {tag}
              <button
                type="button"
                onClick={() =>
                  onSelectedTagsChange(selectedTags.filter((t) => t !== tag))
                }
                className="ml-0.5 opacity-70 hover:opacity-100"
                aria-label={`Remove ${tag}`}
              >
                <X size={10} strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Soft nudge */}
      {overSoft && !atCap && (
        <p className="mb-2 text-xs" style={{ color: "var(--gold)" }}>
          {selectedTags.length} tags selected — Instagram performs best with 5–8.
        </p>
      )}
      {atCap && (
        <p className="mb-2 text-xs" style={{ color: "var(--red)" }}>
          30 tags maximum reached.
        </p>
      )}

      {/* "Proven for you" group */}
      {provenTags.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--text-dim)" }}>
            Proven for you
          </p>
          <div className="flex flex-wrap gap-1.5">
            {provenTags
              .filter((t) => t.toLowerCase() !== PIN_LOWER)
              .map((tag) => (
                <TagChip
                  key={tag}
                  tag={tag}
                  selected={selectedLower.has(tag.toLowerCase())}
                  dimmed={atCap && !selectedLower.has(tag.toLowerCase())}
                />
              ))}
          </div>
        </div>
      )}

      {/* "For this post" group */}
      <div className="mb-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-dim)" }}>
          For this post
          {isFetching && (
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              (suggesting…)
            </span>
          )}
        </p>
        {aiTags.length === 0 && !isFetching && (
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            {caption.length < MIN_CAPTION_LEN
              ? "Type a caption (20+ characters) for live suggestions."
              : photoId
              ? "Suggestions will appear as you type."
              : "Pick a photo to get suggestions."}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {aiTags.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              selected={selectedLower.has(tag.toLowerCase())}
              dimmed={atCap && !selectedLower.has(tag.toLowerCase())}
            />
          ))}
        </div>
      </div>

      {/* Free-type input */}
      <input
        value={freeInput}
        onChange={(e) => setFreeInput(e.target.value)}
        onKeyDown={handleFreeInput}
        placeholder="Type a tag and press Enter…"
        className="w-full rounded p-2 text-sm"
        style={{
          border: "1px solid var(--border-hi)",
          background: "var(--surface-hi)",
          color: "var(--text-primary)",
        }}
      />
      <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
        Press Enter, Space, or comma to add. #PelicanClubNOLA is always included.
      </p>
    </section>
  );
}
