-- Phase 1.1: auto-sorting. Track each photo's assigned category and where it
-- currently lives in Drive after being moved.

alter table photos add column if not exists category text;
alter table photos add column if not exists current_folder_id text;
alter table photos add column if not exists moved_at timestamptz;

create index if not exists photos_category_idx on photos (category);

-- Cache of category-key -> destination Drive folder id, refreshed on each sync.
alter table app_config add column if not exists category_folder_map jsonb;
