-- DM inbox: auto-reply rules, thread store, message store.
-- All access is via service role; RLS enabled with no policies → anon/auth denied by default.

-- ── 1. Auto-reply rules ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_reply_rules (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_pattern text     NOT NULL,
  reply_text   text        NOT NULL,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;

-- ── 2. DM threads ─────────────────────────────────────────────────────────────────────────────────
-- One row per unique conversation with a participant on a given platform.
-- thread_id is the Meta-assigned conversation/thread identifier.

CREATE TABLE IF NOT EXISTS dm_threads (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform             text        NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  thread_id            text        NOT NULL UNIQUE,
  participant_name     text,
  last_message_at      timestamptz,
  last_message_preview text,
  unread_count         integer     NOT NULL DEFAULT 0,
  auto_replied_at      timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dm_threads_last_message_at_idx ON dm_threads (last_message_at DESC);
CREATE INDEX IF NOT EXISTS dm_threads_platform_idx        ON dm_threads (platform);

ALTER TABLE dm_threads ENABLE ROW LEVEL SECURITY;

-- ── 3. DM messages ────────────────────────────────────────────────────────────────────────────────
-- platform_message_id is the idempotency key — Meta retries the same webhook; ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS dm_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id           uuid        NOT NULL REFERENCES dm_threads (id) ON DELETE CASCADE,
  platform_message_id text        NOT NULL UNIQUE,
  direction           text        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body                text        NOT NULL,
  sent_at             timestamptz NOT NULL,
  auto_reply_rule_id  uuid        REFERENCES auto_reply_rules (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dm_messages_thread_id_sent_at_idx ON dm_messages (thread_id, sent_at);

ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
