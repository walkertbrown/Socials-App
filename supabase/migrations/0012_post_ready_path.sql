-- Post-ready path: store a pre-generated 2048px JPEG during processing so
-- publish time is a fast getPublicUrl instead of a full MinIO download + convert.
-- Idempotent: uses IF NOT EXISTS / IF EXISTS guards throughout.

-- ── 1. New column on photos ───────────────────────────────────────────────────
-- NULL  = no pre-generated copy; stage-image falls back to the full-download path.
-- Non-null = path in the 'post-ready' bucket; stage-image uses getPublicUrl directly.

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS post_ready_path TEXT;

-- ── 2. Public bucket for post-ready copies ────────────────────────────────────
-- Mirrors 'post-images' and 'graphics' — must be public so Meta can fetch the URL.
-- Unlike 'post-images', rows here are PERMANENT (keyed by photo UUID, never deleted).

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-ready', 'post-ready', true)
ON CONFLICT (id) DO NOTHING;
