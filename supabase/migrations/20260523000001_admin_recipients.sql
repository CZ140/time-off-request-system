-- Migration: admin_recipients
-- Created: 2026-05-23
--
-- Replaces the ADMIN_EMAILS env var with a database-backed list editable from
-- the admin UI (app/(admin)/admin/_components/RecipientsTab.tsx).
--
-- The application reads this table via SUPABASE_SERVICE_ROLE_KEY which bypasses
-- RLS — same pattern as requests and blackout_dates. RLS is enabled with no
-- policies as defense-in-depth against any future client-side Supabase usage.
--
-- ── SEED: not included in this migration on purpose ──
-- The previous ADMIN_EMAILS value differs per deployment, so the seed row(s)
-- are applied separately. After running this migration, INSERT each existing
-- admin email manually before deleting the env var, e.g.:
--
--   INSERT INTO admin_recipients (email, label) VALUES
--     ('principal@school.edu', 'Principal')
--   ON CONFLICT (email) DO NOTHING;
--
-- Failure mode if the table is empty: the submit action throws a clear error
-- and the teacher sees "We can't send your request right now — no administrator
-- is configured." Far louder than silently sending to no one.

CREATE TABLE IF NOT EXISTS admin_recipients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_recipients ENABLE ROW LEVEL SECURITY;
