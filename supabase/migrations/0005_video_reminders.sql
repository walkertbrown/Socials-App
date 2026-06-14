-- Phase 2.2: video posts via "notification publishing" (reminder), plus web-push.
-- Video posts don't auto-publish (the API can't add trending audio); instead the
-- app pings her phone at post time and she finishes the post manually.

-- How a scheduled post is delivered: 'auto' = app publishes it (photos, unchanged);
-- 'reminder' = app pings her phone and she posts it herself (video).
alter table scheduled_posts
  add column if not exists delivery text not null default 'auto'
  check (delivery in ('auto', 'reminder'));

-- Reminder posts use two extra statuses ('reminder_sent', 'posted'). Widen the
-- existing check to allow them; auto posts keep their original lifecycle.
alter table scheduled_posts drop constraint if exists scheduled_posts_status_check;
alter table scheduled_posts add constraint scheduled_posts_status_check
  check (status in (
    'scheduled', 'publishing', 'published', 'failed', 'canceled',
    'reminder_sent', 'posted'
  ));

-- When the reminder push was sent (for display + so the cron doesn't re-ping).
alter table scheduled_posts add column if not exists notified_at timestamptz;

-- Her browser/phone push subscriptions (one row per device that opts in).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
