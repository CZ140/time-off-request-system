-- Migration: initial_schema
-- Created: 2026-03-10
-- Creates leave_type and request_status native Postgres enums,
-- then the requests and blackout_dates tables.

-- ── Enums ────────────────────────────────────────────────────────────────

CREATE TYPE leave_type AS ENUM (
  'sick',
  'personal',
  'vacation',
  'bereavement',
  'jury_duty',
  'professional_development',
  'maternity_paternity',
  'half_day_am',
  'half_day_pm'
);

CREATE TYPE request_status AS ENUM (
  'pending',
  'approved',
  'denied',
  'auto_denied'
);

-- ── requests table ───────────────────────────────────────────────────────

CREATE TABLE requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name   TEXT NOT NULL,
  teacher_email  TEXT NOT NULL,
  leave_type     leave_type NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  reason         TEXT,
  is_blackout    BOOLEAN NOT NULL DEFAULT false,
  status         request_status NOT NULL DEFAULT 'pending',
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    TEXT
);

-- ── blackout_dates table ─────────────────────────────────────────────────

CREATE TABLE blackout_dates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── admin_recipients table ───────────────────────────────────────────────
-- Database-backed replacement for the legacy ADMIN_EMAILS env var. See
-- 20260523000001_admin_recipients.sql for the standalone migration and
-- guidance on seeding.

CREATE TABLE admin_recipients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE admin_recipients ENABLE ROW LEVEL SECURITY;

-- ── Row Level Security ───────────────────────────────────────────────────
-- Both application tables: RLS enabled with NO policies = deny-all to
-- anon and authenticated keys. The application accesses both tables via
-- SUPABASE_SERVICE_ROLE_KEY (lib/supabase/server.ts), which bypasses RLS.
--
-- NOTE: this migration was amended after initial deployment to add these
-- statements (see 20260522000001_enable_rls_existing_tables.sql). Remote
-- databases created before that amendment will not have RLS applied just
-- by running this file; they need the follow-up migration.

ALTER TABLE requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_dates  ENABLE ROW LEVEL SECURITY;
