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
  'maternity_paternity'
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
