-- supabase/seed.sql
-- Demo data for the public portfolio deployment.
-- Run this in the Supabase SQL editor for the demo project.
-- Safe to re-run: deletes existing seed rows by ID before inserting.

-- ── Schema (create tables if they don't exist) ───────────────────────────

CREATE TABLE IF NOT EXISTS requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name    TEXT NOT NULL,
  teacher_email   TEXT NOT NULL,
  leave_type      TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  reason          TEXT,
  is_blackout     BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'pending',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT
);

CREATE TABLE IF NOT EXISTS blackout_dates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Clean up existing seed rows ──────────────────────────────────────────

DELETE FROM requests WHERE id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000006',
  'a1000000-0000-0000-0000-000000000007',
  'a1000000-0000-0000-0000-000000000008'
);

DELETE FROM blackout_dates WHERE id IN (
  'b1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000003'
);

-- ── Blackout dates ───────────────────────────────────────────────────────

INSERT INTO blackout_dates (id, label, start_date, end_date, created_at) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'State Testing Week',   '2026-04-20', '2026-04-24', now() - interval '60 days'),
  ('b1000000-0000-0000-0000-000000000002', 'Spring Break',         '2026-03-23', '2026-03-27', now() - interval '90 days'),
  ('b1000000-0000-0000-0000-000000000003', 'Professional Dev Day', '2026-05-27', '2026-05-27', now() - interval '30 days');

-- ── Requests ─────────────────────────────────────────────────────────────
-- Mix of statuses, leave types, and submitted dates to make the dashboard
-- look like a system that has been in real use.

INSERT INTO requests (id, teacher_name, teacher_email, leave_type, start_date, end_date, reason, is_blackout, status, submitted_at, reviewed_at, reviewed_by) VALUES

  -- Pending — needs review (shows up prominently for demo)
  ('a1000000-0000-0000-0000-000000000001',
   'James O''Brien', 'jobrien@school.edu', 'vacation',
   '2026-06-09', '2026-06-13',
   'Family vacation planned in advance.',
   false, 'pending',
   now() - interval '2 days', NULL, NULL),

  ('a1000000-0000-0000-0000-000000000002',
   'Maria Chen', 'mchen@school.edu', 'professional_development',
   '2026-05-14', '2026-05-15',
   'Attending the state literacy conference in Austin.',
   false, 'pending',
   now() - interval '4 hours', NULL, NULL),

  ('a1000000-0000-0000-0000-000000000003',
   'Robert Kim', 'rkim@school.edu', 'sick',
   '2026-05-22', '2026-05-22',
   NULL,
   false, 'pending',
   now() - interval '1 hour', NULL, NULL),

  -- Approved
  ('a1000000-0000-0000-0000-000000000004',
   'Sarah Mitchell', 'smitchell@school.edu', 'sick',
   '2026-04-07', '2026-04-08',
   'Flu — doctor''s appointment on the 7th.',
   false, 'approved',
   now() - interval '45 days',
   now() - interval '44 days', 'principal@school.edu'),

  ('a1000000-0000-0000-0000-000000000005',
   'Jennifer Adams', 'jadams@school.edu', 'jury_duty',
   '2026-03-10', '2026-03-14',
   'Summoned for jury duty — documentation attached.',
   false, 'approved',
   now() - interval '75 days',
   now() - interval '74 days', 'admin@school.edu'),

  -- Denied
  ('a1000000-0000-0000-0000-000000000006',
   'Lisa Park', 'lpark@school.edu', 'personal',
   '2026-04-03', '2026-04-04',
   NULL,
   false, 'denied',
   now() - interval '50 days',
   now() - interval '49 days', 'principal@school.edu'),

  -- Auto-denied (blackout period)
  ('a1000000-0000-0000-0000-000000000007',
   'David Thompson', 'dthompson@school.edu', 'vacation',
   '2026-04-21', '2026-04-23',
   'Spring break trip — didn''t realize testing week overlap.',
   true, 'auto_denied',
   now() - interval '20 days', NULL, NULL),

  -- Maternity/paternity — pending, longer duration
  ('a1000000-0000-0000-0000-000000000008',
   'Michael Torres', 'mtorres@school.edu', 'maternity_paternity',
   '2026-07-01', '2026-07-31',
   'New baby expected late June.',
   false, 'pending',
   now() - interval '6 days', NULL, NULL);
