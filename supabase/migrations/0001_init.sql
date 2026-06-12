-- Phase 1 schema: photo triage for a single venue.

create extension if not exists "pgcrypto";

-- One row per Drive photo we've seen.
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  drive_name text,
  thumbnail_path text,
  tags text[],
  perceptual_hash text,
  duplicate_group_id uuid,
  status text not null default 'processing' check (status in ('processing', 'ready')),
  picked boolean not null default false,
  picked_at timestamptz,
  posted boolean, -- reserved for Phase 2 (scheduling/publishing); unused in Phase 1
  created_at timestamptz not null default now()
);

create index if not exists photos_status_idx on photos (status);
create index if not exists photos_picked_idx on photos (picked);
create index if not exists photos_dupe_idx on photos (duplicate_group_id);

-- Log of each "Sync now".
create table if not exists import_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  files_seen integer not null default 0,
  files_new integer not null default 0
);

-- Single-row config (reserved for forward use, e.g. the watched folder / sync cursor).
create table if not exists app_config (
  id integer primary key default 1,
  watched_folder_id text,
  last_sync_cursor text,
  constraint app_config_singleton check (id = 1)
);
insert into app_config (id) values (1) on conflict (id) do nothing;

-- All app access is server-side via the service role, which bypasses RLS.
-- Enabling RLS with no policies denies direct anon/auth access by default.
alter table photos enable row level security;
alter table import_runs enable row level security;
alter table app_config enable row level security;

-- Private bucket for thumbnails. Served through short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', false)
on conflict (id) do nothing;
