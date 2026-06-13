-- Phase 2.1: intent-first compose. Give each photo a short AI description so
-- "what do you want to post about?" searches match against real content, and
-- index tags + description so matching is a free DB lookup (no AI per search).

alter table photos add column if not exists description text;

-- Tags are a text[] (e.g. {staff, wine, bar}); GIN lets us match "has this tag" fast.
create index if not exists photos_tags_gin on photos using gin (tags);

-- Full-text index over the description for keyword search ("shrimp", "patio").
create index if not exists photos_description_fts
  on photos using gin (to_tsvector('english', coalesce(description, '')));
