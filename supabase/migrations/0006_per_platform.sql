-- Phase 3: per-platform scheduling + video auto-publish as Reels.
--
-- Key decisions:
--   - One row per (content × platform). Cross-post = N rows under one post_group_id.
--   - Existing 'platforms text[]' column is EXPLODED into per-row 'platform text'.
--   - Reel "processing" state lives in publish_substate, not a new top-level status.
--   - post-videos bucket is public so Meta can fetch the staged URL directly.

-- ── 1. New columns ─────────────────────────────────────────────────────────────

alter table scheduled_posts
  add column if not exists platform text,          -- 'instagram' | 'facebook'
  add column if not exists post_group_id uuid,     -- shared across sibling rows in one compose
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video')),
  add column if not exists ig_container_id text,   -- IG Reel container while processing
  add column if not exists fb_video_id text,       -- FB video_reels id during upload
  add column if not exists staged_path text,       -- storage path of the staged public video
  add column if not exists publish_substate text;  -- 'staging' | 'ig_container_created' | 'fb_upload_started' | 'fb_upload_done' | null

-- ── 2. Indexes ─────────────────────────────────────────────────────────────────

-- Supports cron's due-post queries filtered by type.
create index if not exists scheduled_posts_due_v2_idx
  on scheduled_posts (status, delivery, media_type, scheduled_at);

-- Lets the dashboard group sibling rows into one card.
create index if not exists scheduled_posts_group_idx
  on scheduled_posts (post_group_id);

-- ── 3. Backfill existing rows (safe no-op when table is empty) ─────────────────
--
-- Each row that has platforms[] = {'instagram','facebook'} becomes TWO rows:
-- one per platform, both sharing a fresh post_group_id. Rows with a single
-- platform value get that value as their `platform` column and a group id too.

do $$
declare
  r record;
  gid uuid;
begin
  for r in
    select id, platforms
    from scheduled_posts
    where platform is null and platforms is not null and array_length(platforms, 1) > 0
  loop
    gid := gen_random_uuid();

    if array_length(r.platforms, 1) = 1 then
      -- Single-platform row: in-place update.
      update scheduled_posts
        set platform = r.platforms[1], post_group_id = gid
      where id = r.id;
    else
      -- Multi-platform row: the original row takes platforms[1]; new rows are
      -- inserted for the rest, cloning all relevant columns.
      update scheduled_posts
        set platform = r.platforms[1], post_group_id = gid
      where id = r.id;

      for i in 2 .. array_length(r.platforms, 1) loop
        insert into scheduled_posts (
          photo_id, caption, platform, post_group_id, media_type,
          scheduled_at, status, delivery, attempts, error,
          fb_post_id, ig_post_id, created_at, published_at, notified_at
        )
        select
          photo_id, caption, r.platforms[i], gid, 'image',
          scheduled_at, status, delivery, attempts, error,
          fb_post_id, ig_post_id, created_at, published_at, notified_at
        from scheduled_posts
        where id = r.id;
      end loop;
    end if;
  end loop;
end $$;

-- ── 4. Drop the now-redundant array column ─────────────────────────────────────
--
-- Safe because every row now has `platform` (or was already null/empty).

alter table scheduled_posts drop column if exists platforms;

-- ── 5. Public bucket for staged videos ────────────────────────────────────────
--
-- Mirrors the post-images bucket added in 0003, but for videos.
-- Longer sweep cutoff applies (Reels processing can take several minutes).

insert into storage.buckets (id, name, public)
values ('post-videos', 'post-videos', true)
on conflict (id) do nothing;
