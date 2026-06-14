-- Weekly Insights Report schema.
-- Idempotent: every statement uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Apply this before deploying the weekly-insights feature.

-- ── 1. Add views to post_insights (per-post video views from Meta) ─────────────
-- views replaces impressions/plays per ground-truth probe — Meta returns 'views'
-- for both IG and FB short-form content.

alter table post_insights
  add column if not exists views int;

-- ── 2. Add source to scheduled_posts (null = composed in-app; 'native' = swept) ─

alter table scheduled_posts
  add column if not exists source text;

-- ── 3. Weekly account-level snapshots ────────────────────────────────────────────
-- One row per platform per week. reach/views/net_followers come from the
-- account-level Meta endpoints (not per-post sums).
-- demographics stores the parsed IG follower_demographics JSON blob.

create table if not exists weekly_account_snapshots (
  id              uuid primary key default gen_random_uuid(),
  platform        text not null,
  week_start      date not null,  -- Monday (America/Chicago) of the week
  reach           int,
  views           int,
  net_followers   int,
  engagement      int,
  link_taps       int,
  followers_count int,
  demographics    jsonb,
  created_at      timestamptz not null default now(),
  unique(platform, week_start)
);

-- ── 4. Weekly report rows ─────────────────────────────────────────────────────────
-- One row per week. week_start UNIQUE is the idempotency lock: the cron uses
-- INSERT … ON CONFLICT DO NOTHING as its lock, then checks narratives_generated_at
-- before calling Claude — so a retry never duplicates the LLM spend.
--
-- payload      : full structured data (post table, account metrics, gates) as JSON
-- win_text     : Claude "Win of the week" narrative (2-3 sentences)
-- recommend_text: Claude "Recommended focus" narrative (2-3 sentences)
-- flag_text    : rule-based "Flag of the week" insight (no Claude call)
-- narratives_generated_at: set after BOTH Claude calls succeed; null = not generated

create table if not exists weekly_reports (
  id                      uuid primary key default gen_random_uuid(),
  week_start              date not null unique,
  status                  text not null default 'pending',
  payload                 jsonb,
  win_text                text,
  recommend_text          text,
  flag_text               text,
  narratives_generated_at timestamptz,
  generated_at            timestamptz,
  created_at              timestamptz not null default now()
);

-- ── 5. Report goal singleton ───────────────────────────────────────────────────────
-- id=1 only, enforced by constraint.  Default goal is net follower growth.
-- Owner can update the goal text via an admin action (not exposed in v1 UI).

create table if not exists report_goal (
  id   int primary key default 1,
  goal text not null default 'net follower growth',
  constraint report_goal_singleton check (id = 1)
);

insert into report_goal (id, goal) values (1, 'net follower growth')
  on conflict do nothing;

-- ── 6. Indexes ────────────────────────────────────────────────────────────────────
-- Weekly report reads: find the latest week quickly.
create index if not exists weekly_reports_week_start_idx
  on weekly_reports (week_start desc);

-- Snapshot reads: per-platform ordered by week.
create index if not exists weekly_account_snapshots_platform_week_idx
  on weekly_account_snapshots (platform, week_start desc);

-- ── 7. Row-level security (mirrors the rest of the schema) ───────────────────────

alter table weekly_account_snapshots enable row level security;
alter table weekly_reports           enable row level security;
alter table report_goal              enable row level security;
