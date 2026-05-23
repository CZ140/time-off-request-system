-- Migration: add_half_day_leave_types
-- Created: 2026-05-23
--
-- Adds two new leave_type enum values for partial-day leave:
--   - 'half_day_am' (morning off)
--   - 'half_day_pm' (afternoon off)
--
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is idempotent (Postgres 10+), so
-- re-running this migration on a database that already has the values is safe.
--
-- The initial schema migration (20260310000000_initial_schema.sql) is being
-- amended in the same commit to include these values so fresh deployments
-- get them on the first run. This file exists for live databases that were
-- created before the amendment.

ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'half_day_am';
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'half_day_pm';
