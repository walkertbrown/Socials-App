-- Phase 2: scheduling posts to Facebook + Instagram.

create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid references photos(id),
  caption text not null default '',
  platforms text[] not null default '{}',            -- e.g. {facebook, instagram}
  scheduled_at timestamptz not null,                 -- stored in UTC
  status text not null default 'scheduled'
    check (status in ('scheduled', 'publishing', 'published', 'failed', 'canceled')),
  attempts integer not null default 0,
  error text,
  fb_post_id text,
  ig_post_id text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
-- Supports the cron's "due now" lookup (status + time).
create index if not exists scheduled_posts_due_idx on scheduled_posts (status, scheduled_at);

-- Single-row Meta credentials, kept in the DB so the ~60-day token can be
-- refreshed without a redeploy. App id/secret stay in env vars.
create table if not exists meta_credentials (
  id integer primary key default 1,
  page_id text,
  ig_user_id text,
  page_token text,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint meta_credentials_singleton check (id = 1)
);
insert into meta_credentials (id) values (1) on conflict (id) do nothing;

alter table scheduled_posts enable row level security;
alter table meta_credentials enable row level security;

-- Public bucket for briefly staging a full-res image at publish time so Meta can
-- fetch it. The file is deleted right after publishing (and swept if left behind).
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;
