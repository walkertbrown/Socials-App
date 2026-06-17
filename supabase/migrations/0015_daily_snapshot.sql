-- Daily account-level snapshot — "This week so far" numbers.
-- Stores IG + FB headline metrics for the current (in-progress) week.
-- Refreshed once daily by the home-server cron at ~6:10am Chicago.
-- Idempotent: every statement uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Apply this before deploying the daily-insights-refresh feature.

-- ── 1. Daily account snapshots ───────────────────────────────────────────────
-- One row per platform per week_start (the Monday that starts the current week).
-- The upsert key is (platform, week_start) — the cron ALWAYS uses the current
-- Monday, never today's date, so the table grows by one row per platform per week
-- (not per day). The cron overwrites the single row each morning.
--
-- captured_at  : timestamp when the Meta API call completed (live freshness label)
-- updated_at   : set on every upsert (freshness guard uses this column)
-- followers_count: live IG follower count from the user object (not net growth)
-- net_followers  : delta vs the most recent completed weekly snapshot; null if no prior week

CREATE TABLE IF NOT EXISTS daily_account_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        text        NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  week_start      date        NOT NULL,  -- Monday (America/Chicago) of the current week
  reach           int,
  views           int,
  net_followers   int,
  engagement      int,
  link_taps       int,
  followers_count int,
  captured_at     timestamptz NOT NULL,  -- when Meta responded
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, week_start)
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────
-- Latest row per platform — used by getLatestDailySnapshots.
CREATE INDEX IF NOT EXISTS daily_account_snapshots_platform_captured_idx
  ON daily_account_snapshots (platform, captured_at DESC);

-- Freshness check — used by the cron guard (updated_at > now() - interval '4 hours').
CREATE INDEX IF NOT EXISTS daily_account_snapshots_platform_week_updated_idx
  ON daily_account_snapshots (platform, week_start, updated_at DESC);

-- ── 3. Row-level security (mirrors the rest of the schema) ───────────────────
-- All access is via service role only; RLS enabled with no policies →
-- anon/auth users are denied by default (same pattern as other tables).
ALTER TABLE daily_account_snapshots ENABLE ROW LEVEL SECURITY;
