-- Upload → review → approve flow: extends status, adds drive mirror column + index.
-- Idempotent: uses IF NOT EXISTS / IF EXISTS guards throughout.

-- ── 1. Extend the status CHECK to include 'pending_review' ───────────────────────────────────────
-- PostgreSQL requires dropping and re-adding a named constraint.
-- If the constraint doesn't exist yet (first run), the DROP is skipped via a DO block.

DO $$
BEGIN
  ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_status_check;
  ALTER TABLE photos
    ADD CONSTRAINT photos_status_check
      CHECK (status IN ('processing', 'pending_review', 'ready'));
END
$$;

-- ── 2. Drive mirror timestamp ─────────────────────────────────────────────────────────────────────
-- NULL  = not yet placed in Drive (box job will pick it up).
-- Non-null = already placed; the box job skips it.

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS drive_placed_at TIMESTAMPTZ;

-- ── 3. Mark all existing rows as already-placed ───────────────────────────────────────────────────
-- Every row that existed before this feature was added already lives in Drive
-- (it came from the original Drive→MinIO migration). Stamp them now so the box
-- job never tries to re-dump the legacy library.

UPDATE photos
  SET drive_placed_at = now()
  WHERE drive_placed_at IS NULL;

-- ── 4. Index for the board date filter (Phase 4) ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos (created_at DESC);
