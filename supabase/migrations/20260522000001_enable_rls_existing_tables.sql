-- Migration: enable_rls_existing_tables
-- Created: 2026-05-22
--
-- Enables Row Level Security on the requests and blackout_dates tables to match
-- the posture established for rate_limit_log in the immediately preceding migration.
-- These tables were originally created (20260310000000_initial_schema.sql) without
-- RLS; verified via pg_tables.rowsecurity that the remote database also has it off.
--
-- The application reads/writes both tables exclusively via SUPABASE_SERVICE_ROLE_KEY
-- (see lib/supabase/server.ts), which bypasses RLS entirely. No production code path
-- is affected by enabling RLS here.
--
-- INTENTIONALLY NO POLICIES. The goal is to block any access via the anon key
-- (defense-in-depth against future code that might wire up a client-side Supabase
-- client, or against a leaked NEXT_PUBLIC_SUPABASE_ANON_KEY in a forked deployment).
-- Adding permissive policies would defeat this purpose.
--
-- The initial schema migration (20260310000000_initial_schema.sql) is being updated
-- in the same commit to include these statements for fresh deployments. This migration
-- exists separately to address remote databases that were created before the initial
-- migration was amended.

ALTER TABLE requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_dates  ENABLE ROW LEVEL SECURITY;
