-- Migration: microsoft_calendar_sync
-- Created: 2026-05-28
--
-- Adds the single-row calendar sync connection (used by the "Sign in with
-- Microsoft" flow to push approved time-off events to one shared Outlook
-- calendar) and the per-request columns that remember the created event so it
-- can be removed later.
--
-- Design notes:
--   * calendar_connections holds ONE row (id = 'default'). The cache_cipher
--     column is the AES-256-GCM-encrypted MSAL token cache blob; it may contain
--     tokens for several admin accounts (every admin signs in through the same
--     MSAL app), but sync_home_account_id selects WHICH account actually owns
--     the writes. Whoever signs in first establishes the sync target; later
--     sign-ins get dashboard access without hijacking it.
--   * The login allowlist is NOT here — it reuses the existing admin_recipients
--     table (see lib/auth/admin-allowlist.ts).

-- ── calendar_connections table ───────────────────────────────────────────

CREATE TABLE calendar_connections (
  id                   TEXT PRIMARY KEY DEFAULT 'default',
  provider             TEXT NOT NULL DEFAULT 'microsoft',
  -- Display fields for the Calendar Sync tab.
  account_email        TEXT,
  -- MSAL homeAccountId of the account whose calendar receives the events.
  sync_home_account_id TEXT,
  -- Chosen Outlook calendar. NULL = the account's default calendar.
  calendar_id          TEXT,
  calendar_name        TEXT,
  -- Encrypted serialized MSAL token cache: 'iv:tag:ciphertext' (all base64).
  cache_cipher         TEXT NOT NULL,
  connected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled with NO policies = deny-all to anon/authenticated keys. The app
-- reaches this table only via SUPABASE_SERVICE_ROLE_KEY (lib/supabase/server.ts),
-- which bypasses RLS. The cache blob is a credential, so this lock-down matters.
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

-- ── requests: remember the synced event ──────────────────────────────────

ALTER TABLE requests
  ADD COLUMN calendar_event_id TEXT,
  ADD COLUMN calendar_provider TEXT;
