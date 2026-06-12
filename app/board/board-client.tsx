"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/types";
import { FilterBar, type TagFilter } from "@/components/filter-bar";
import { PhotoTile } from "@/components/photo-tile";
import { useSync } from "@/lib/hooks/use-sync";

const PAGE_SIZE = 50;

export function BoardClient({
  initialPhotos,
  userEmail,
}: {
  initialPhotos: Photo[];
  userEmail: string;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [filter, setFilter] = useState<TagFilter>("all");
  const [pickedOnly, setPickedOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Refresh server data when a sync finishes; keep local state in step with it.
  const { progress, runSync } = useSync(useCallback(() => router.refresh(), [router]));
  useEffect(() => setPhotos(initialPhotos), [initialPhotos]);

  const filtered = useMemo(
    () =>
      photos.filter((p) => {
        if (pickedOnly && !p.picked) return false;
        if (filter !== "all" && !(p.tags ?? []).includes(filter)) return false;
        return true;
      }),
    [photos, filter, pickedOnly]
  );

  // Collapse near-duplicates: one representative per duplicate group.
  const groups = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const p of filtered) {
      const key = p.duplicate_group_id ?? p.id;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return Array.from(map.values());
  }, [filtered]);

  const togglePick = useCallback(async (photo: Photo) => {
    const picked = !photo.picked;
    setPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, picked } : p))
    );
    await fetch("/api/photos/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: photo.id, picked }),
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <FilterBar
        active={filter}
        onChange={setFilter}
        showOnlyPicked={pickedOnly}
        onTogglePicked={() => setPickedOnly((v) => !v)}
        onSync={runSync}
        progress={progress}
      />

      <div className="flex items-center justify-between px-4 py-2 text-sm text-zinc-500">
        <span>{filtered.length} photos</span>
        <div className="flex items-center gap-2">
          {userEmail}
          <form action="/auth/signout" method="post">
            <button className="underline">Sign out</button>
          </form>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="px-4 py-16 text-center text-zinc-400">
          No photos yet. Click “Sync now” to pull them in from Drive.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {groups.slice(0, visible).flatMap((group) => {
            const rep = group[0];
            const key = rep.duplicate_group_id ?? rep.id;
            const isOpen = expanded.has(key);
            const shown = isOpen ? group : [rep];
            return shown.map((p, idx) => (
              <PhotoTile
                key={p.id}
                photo={p}
                onTogglePick={togglePick}
                extraCount={
                  !isOpen && idx === 0 && group.length > 1
                    ? group.length - 1
                    : undefined
                }
                onExpand={() =>
                  setExpanded((s) => new Set(s).add(key))
                }
              />
            ));
          })}
        </div>
      )}

      {visible < groups.length && (
        <div className="flex justify-center pb-8">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
