-- Graphics feature: in-app branded graphic generator.
-- Idempotent: every statement uses IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ── 1. Add text_safe flag to photos ─────────────────────────────────────────────
-- text_safe=true means AI is allowed to overlay text on this photo (good exposure,
-- simple background, clear focal point). False is the safe default — the user
-- marks individual photos as safe via the board tag editor.

alter table photos
  add column if not exists text_safe boolean not null default false;

-- ── 2. Graphics table ────────────────────────────────────────────────────────────
-- One row per saved graphic. Preview/regenerate renders are transient and never
-- persisted here — only an explicit Save writes a row.
--
-- design_spec: the AI-produced fill spec (template_id, copy slots, palette, font,
--              logo_variant, photo_id) stored as JSONB for audit + re-render.
-- png_path   : path in the 'graphics' storage bucket.
-- size       : 'feed' (1080×1080) or 'story' (1080×1920).
-- status     : 'saved' is the only value now; reserved for future states.

create table if not exists graphics (
  id           uuid primary key default gen_random_uuid(),
  design_spec  jsonb not null,
  png_path     text,
  size         text not null check (size in ('feed', 'story')),
  status       text not null default 'saved',
  created_at   timestamptz not null default now()
);

create index if not exists graphics_created_at_idx on graphics (created_at desc);

-- ── 3. Public graphics storage bucket ────────────────────────────────────────────
-- Graphics are PUBLIC so Meta can fetch them for publishing, exactly like
-- post-images. Scheduled graphics reference this bucket's URLs.

insert into storage.buckets (id, name, public)
values ('graphics', 'graphics', true)
on conflict (id) do nothing;

-- ── 4. RLS (mirrors the rest of the schema) ──────────────────────────────────────
-- All access is via the service-role client which bypasses RLS. Enabling RLS with
-- no policies blocks direct anon/auth access by default (defense in depth).

alter table graphics enable row level security;
