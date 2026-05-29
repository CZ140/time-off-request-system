-- Migration: rename_blackout_to_blockout
-- Created: 2026-05-28
-- Renames the legacy "blackout" schema objects to "blockout" to match the
-- corrected terminology used throughout the application.
--
--   blackout_dates table    -> blockout_dates
--   requests.is_blackout    -> requests.is_blockout
--
-- The earlier migrations (e.g. 20260310000000_initial_schema.sql) were also
-- updated to use the new names so that a fresh `supabase db reset` produces the
-- correct schema directly. This migration exists for databases that were
-- already deployed with the old names. Each step is guarded so it is a safe
-- no-op on a freshly-reset database where the rename has effectively already
-- happened.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'blackout_dates'
  ) THEN
    ALTER TABLE blackout_dates RENAME TO blockout_dates;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'requests'
      AND column_name = 'is_blackout'
  ) THEN
    ALTER TABLE requests RENAME COLUMN is_blackout TO is_blockout;
  END IF;
END $$;
