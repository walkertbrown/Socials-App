-- Outreach send scheduler (Step 1: dry-run, no real sends).
-- A row = "send N emails on this date." The UI prefills it with the warm-up ramp.
-- Service-role access only; RLS enabled with no policies (anon/auth denied).
-- Apply AFTER 0016_outreach.sql.

-- ── 1. Schedule ────────────────────────────────────────────────────────────────
-- One row per planned batch. status: 'pending' → 'done' (set by the daily drip).
-- sent_count records how many actually went out (may be < target_count on a
-- shortfall when fewer approved drafts are ready than the batch calls for).
CREATE TABLE IF NOT EXISTS outreach_schedule (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date  date        NOT NULL,
  target_count    integer     NOT NULL DEFAULT 0 CHECK (target_count >= 0),
  sent_count      integer     NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_schedule_date_idx ON outreach_schedule (scheduled_date);

ALTER TABLE outreach_schedule ENABLE ROW LEVEL SECURITY;

-- ── 2. Suppression list ────────────────────────────────────────────────────────
-- Emails we must never send to. Empty until Step 2 wires unsubscribe + bounce/
-- complaint webhooks; the sendable pool already excludes anything listed here.
CREATE TABLE IF NOT EXISTS outreach_suppression (
  email       text        PRIMARY KEY,
  reason      text        NOT NULL DEFAULT 'unsubscribe' CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outreach_suppression ENABLE ROW LEVEL SECURITY;

-- ── 3. Per-draft send tracking ─────────────────────────────────────────────────
-- send_status: NULL (unsent) | 'simulated' (dry-run) | 'sent' | 'failed'.
-- sent_at marks a draft as consumed so the sendable pool never re-picks it.
ALTER TABLE outreach_drafts ADD COLUMN IF NOT EXISTS sent_at     timestamptz;
ALTER TABLE outreach_drafts ADD COLUMN IF NOT EXISTS send_status text;
ALTER TABLE outreach_drafts ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES outreach_schedule (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS outreach_drafts_sent_at_idx ON outreach_drafts (sent_at);
