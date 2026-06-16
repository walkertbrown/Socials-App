-- Carousel support: allow a scheduled post to reference an ordered list of
-- photos (Instagram carousel / Facebook multi-image). When photo_ids is set,
-- it supersedes the single photo_id column for publishing purposes.
alter table scheduled_posts
  add column if not exists photo_ids uuid[] default null;
