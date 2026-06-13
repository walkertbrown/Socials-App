-- Learning loop: AI captions that improve over time from draft-vs-final diffs,
-- posted captions, and (later) per-post Meta engagement metrics.
--
-- Idempotent: every statement uses IF NOT EXISTS / ON CONFLICT DO NOTHING
-- so it's safe to run on a live DB with existing data or an empty one.

-- ── 1. Capture the AI draft and mark high-quality posts as exemplars ───────────
--
-- ai_draft   : the raw AI-generated caption before she edits it. Populated at
--              schedule time so we can later diff it against her final caption.
-- is_exemplar: pinned by her via the ⭐ toggle — always included in voice corpus.

alter table scheduled_posts
  add column if not exists ai_draft text,
  add column if not exists is_exemplar boolean not null default false;

-- ── 2. Insights staleness tracking (per row) ──────────────────────────────────
--
-- insights_fetched_at: when we last pulled metrics from Meta; null = never.
-- insights_final     : true once the post is >30 days old — never re-fetched.

alter table scheduled_posts
  add column if not exists insights_fetched_at timestamptz,
  add column if not exists insights_final boolean not null default false;

-- ── 3. Per-post engagement metrics (populated from Meta Graph API) ─────────────

create table if not exists post_insights (
  post_id    uuid primary key references scheduled_posts(id),
  platform   text,
  reach      int,
  likes      int,
  comments   int,
  saves      int,
  shares     int,
  fetched_at timestamptz not null default now()
);

-- ── 4. Hashtag vocabulary (built from posted captions; perf_score added by sync) ─

create table if not exists hashtag_vocab (
  id          uuid primary key default gen_random_uuid(),
  tag         text not null,
  -- category matches the photo category the tag appeared with (null = global)
  category    text,
  use_count   int not null default 0,
  perf_score  numeric,
  last_used_at timestamptz,
  unique(tag, category)
);

-- ── 5. Style note singleton (summarizes recurring AI-vs-final edit patterns) ───
--
-- One row only (id=1), enforced by the check constraint.
-- pairs_since_last_run: how many new ai_draft/caption pairs since the last
-- Claude summarise call — the double gate for cost control.

create table if not exists style_note (
  id                  int primary key default 1,
  note                text,
  last_generated_at   timestamptz,
  pairs_since_last_run int not null default 0,
  constraint style_note_singleton check (id = 1)
);

-- Ensure the singleton row exists on first run.
insert into style_note (id) values (1) on conflict do nothing;

-- ── 6. Indexes (keep cron queries fast even as posts accumulate) ───────────────
--
-- Corpus reads: posted rows ordered by recency.
create index if not exists scheduled_posts_corpus_idx
  on scheduled_posts (status, published_at desc);

-- Insights sync: find rows that need a fresh fetch.
create index if not exists scheduled_posts_insights_idx
  on scheduled_posts (status, insights_fetched_at);

-- ── 7. Row-level security (mirrors the rest of the schema) ───────────────────

alter table post_insights   enable row level security;
alter table hashtag_vocab   enable row level security;
alter table style_note      enable row level security;
