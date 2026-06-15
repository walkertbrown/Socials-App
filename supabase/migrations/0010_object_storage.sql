-- Object-storage migration: adds MinIO-backed fields and relaxes the Drive-only constraint.
-- Idempotent: every statement uses IF NOT EXISTS / IF EXISTS guards or is otherwise safe to re-run.

-- ── 1. New columns on photos ─────────────────────────────────────────────────────────────────────
-- object_key   : the stable MinIO key (e.g. "2024/IMG_1234.jpg"). This becomes the new idempotency
--                anchor for sync going forward. NULL on old rows until the backfill runs.
-- storage_backend : 'minio' for new photos; 'drive' for legacy rows that haven't been migrated yet.
-- display_name : user-friendly rename (shown on the board, downloaded with). NULL = use drive_name.

alter table photos
  add column if not exists object_key text unique,
  add column if not exists storage_backend text not null default 'minio',
  add column if not exists display_name text;

-- ── 2. Make drive_file_id nullable ───────────────────────────────────────────────────────────────
-- New photos ingested from MinIO will not have a Drive file id. Keep the column and existing data
-- for legacy/audit but remove the NOT NULL so new rows can omit it.

alter table photos
  alter column drive_file_id drop not null;

-- ── 3. Index on object_key for sync idempotency lookups ──────────────────────────────────────────
create index if not exists photos_object_key_idx on photos (object_key);

-- ── 4. Index on storage_backend for future queries that filter by backend ────────────────────────
create index if not exists photos_storage_backend_idx on photos (storage_backend);

-- NOTE: data backfill (setting object_key + storage_backend='minio' on existing rows)
-- is NOT here — the bucket is empty until Walker runs the rclone Drive→MinIO copy.
-- See scripts/backfill-object-keys.mjs for the idempotent backfill to run afterwards.
