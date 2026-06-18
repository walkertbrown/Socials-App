-- Outreach engine: guest list, segmentation, and draft store.
-- All access is via service role; RLS enabled with no policies → anon/auth denied by default.
-- Apply this migration before deploying the outreach feature.

-- ── 1. Guests ─────────────────────────────────────────────────────────────────
-- One row per unique guest email (natural key for idempotent upsert from CSV).
-- birthday / anniversary / first_visit_date are stored as DATE so we can query
-- month+day without timezone arithmetic on the app side.
-- notes is a concatenation of the free-text GuestCenter fields.
-- bucket: 'personalized' if notes present; 'standard' otherwise.
-- email_verify_status / email_verified_at: reserved for NeverBounce (next chunk).

CREATE TABLE IF NOT EXISTS guests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text        NOT NULL UNIQUE,
  guest_name          text,
  marketing_opt_in    boolean     NOT NULL DEFAULT false,
  birthday            date,
  anniversary         date,
  first_visit_date    date,
  recent_visit_date   date,
  completed_visits    integer,
  lifetime_spend      numeric(10, 2),
  notes               text,
  segment             text,
  bucket              text        NOT NULL DEFAULT 'standard' CHECK (bucket IN ('personalized', 'standard')),
  email_verify_status text,
  email_verified_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guests_email_idx  ON guests (email);
CREATE INDEX IF NOT EXISTS guests_bucket_idx ON guests (bucket);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

-- ── 2. Outreach drafts ────────────────────────────────────────────────────────
-- One row per generated email draft, keyed to a guest.
-- personalized_from stores the fields that were used to personalise the draft
-- so we can show the user why a particular angle was chosen.
-- status: 'draft' → 'approved' → 'sent' (tracked in a later chunk).

CREATE TABLE IF NOT EXISTS outreach_drafts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id            uuid        NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
  occasion_type       text,
  angle               text,
  subject             text        NOT NULL,
  body                text        NOT NULL,
  status              text        NOT NULL DEFAULT 'draft',
  personalized_from   jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_drafts_guest_id_idx ON outreach_drafts (guest_id);
CREATE INDEX IF NOT EXISTS outreach_drafts_status_idx   ON outreach_drafts (status);

ALTER TABLE outreach_drafts ENABLE ROW LEVEL SECURITY;
