-- Migration: rate_limit_log
-- Created: 2026-05-22
-- Append-only log of rate-limited actions. Used by lib/rate-limit.ts to count
-- occurrences within a rolling time window without needing Redis.

CREATE TABLE rate_limit_log (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT        NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index supports the hot query: COUNT(*) WHERE key = ? AND occurred_at > ?
CREATE INDEX rate_limit_log_key_time_idx
  ON rate_limit_log (key, occurred_at DESC);

-- RLS enabled with NO policies = deny-all to anon and authenticated keys.
-- The application reads/writes this table exclusively via SUPABASE_SERVICE_ROLE_KEY
-- (see lib/supabase/server.ts), which bypasses RLS. So the app is unaffected.
-- This is defense-in-depth against future code that might wire up a client-side
-- Supabase client, or against a leaked anon key.
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Periodic cleanup: rows older than 24 hours are useless for any rate window we use
-- (max window is 1 hour). The application does NOT clean this up itself — run this
-- manually or via a Supabase scheduled job:
--
--   DELETE FROM rate_limit_log WHERE occurred_at < now() - interval '24 hours';
--
-- With ~10 teachers submitting a few times per day, the table stays small even
-- without cleanup (well under 1000 rows/day).
