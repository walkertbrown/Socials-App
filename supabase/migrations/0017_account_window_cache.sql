-- Cache table for the insights time-window selector.
-- Stores live Meta API responses for daily and monthly windows (30-min TTL).
-- The alltime window reads from weekly_account_snapshots (no live Meta call).
-- Modeled after 0015_daily_snapshot.sql.
-- Idempotent: uses IF NOT EXISTS / ON CONFLICT DO NOTHING patterns.

-- ── 1. Cache table ─────────────────────────────────────────────────────────────
-- One row per (platform, window_key). Upsert overwrites on every fresh fetch.
-- fetched_at is updated on every write and used for the 30-min TTL check.

CREATE TABLE IF NOT EXISTS account_window_cache (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    text        NOT NULL,
  window_key  text        NOT NULL,
  payload     jsonb,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, window_key)
);

-- ── 2. Index ───────────────────────────────────────────────────────────────────
-- Freshness check: fetched_at > now() - interval '30 minutes'.
CREATE INDEX IF NOT EXISTS account_window_cache_platform_key_fetched_idx
  ON account_window_cache (platform, window_key, fetched_at DESC);

-- ── 3. Row-level security (mirrors the rest of the schema) ────────────────────
-- All access is via service role only; RLS enabled with no policies ->
-- anon/auth users are denied by default (same pattern as other tables).
ALTER TABLE account_window_cache ENABLE ROW LEVEL SECURITY;
