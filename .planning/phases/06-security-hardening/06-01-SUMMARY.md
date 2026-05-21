---
phase: 6
plan: "06-01"
title: "Env var guard, security headers, and email format validation"
requirements_addressed: [SEC-03, SEC-04, SEC-05]
completed: "2026-05-21"
tsc_passed: true
---

# Phase 6 Plan 01: Env Var Guard, Security Headers, and Email Format Validation Summary

**One-liner:** Startup env var validation (SEC-05), HTTP security headers on all routes (SEC-04), and server-side email regex check (SEC-03) added in a single pass with no new dependencies.

## What Was Built

### Files Created

| File | Description |
|------|-------------|
| `lib/config.ts` | New module — validates 8 required env vars at module load time; throws descriptive errors for missing vars and throws if SESSION_SECRET is shorter than 32 characters |

### Files Modified

| File | Change |
|------|--------|
| `lib/supabase/server.ts` | Added `import '@/lib/config'` side-effect import after `import 'server-only'` |
| `lib/auth/session.ts` | Added `import '@/lib/config'` side-effect import after `import 'server-only'` |
| `next.config.ts` | Replaced empty config with a `headers()` function applying 4 security headers to all routes via `'/(.*)'` source pattern |
| `app/(public)/actions.ts` | Added `EMAIL_REGEX` constant; extended email validation with `else if` format check returning `'Please enter a valid email address.'` |

## Key Decisions Made

1. **APPROVAL_SECRET excluded from REQUIRED_VARS** — The legacy `APPROVAL_SECRET` var is not included in lib/config.ts's required list. It is deprecated by `APPROVAL_HMAC_SECRET` (SEC-02). Excluding it lets operators cleanly remove the old var without triggering a startup crash. `APPROVAL_HMAC_SECRET` is required instead.

2. **middleware.ts left untouched** — middleware.ts runs in the Edge Runtime. Importing `lib/config.ts` (which uses `server-only`) from there would cause a build error. The middleware reads `SESSION_SECRET` directly via `process.env` — this is intentional and was left unchanged.

3. **EMAIL_REGEX kept simple** — `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` catches obvious invalids (no `@`, no dot in domain, whitespace) without over-constraining exotic but technically valid addresses. More complex RFC 5321 regex would reject valid edge cases.

4. **Full replacement of next.config.ts** — The original file was 7 lines with only a placeholder comment. A full replacement was the cleanest approach rather than inserting around boilerplate.

## Commits

| Hash | Message |
|------|---------|
| `5b046e2` | feat(06-01): add env var validation module and wire into server entry points (SEC-05) |
| `9b47293` | feat(06-01): add HTTP security headers to all routes via next.config.ts (SEC-04) |
| `f2161d8` | feat(06-01): add server-side email format validation to submitRequest (SEC-03) |

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Verification

`npx tsc --noEmit` — **PASSED** (zero errors, zero warnings)

## Self-Check: PASSED

- [x] `lib/config.ts` exists and contains the REQUIRED_VARS loop and SESSION_SECRET length check
- [x] `lib/supabase/server.ts` imports `@/lib/config` immediately after `import 'server-only'`
- [x] `lib/auth/session.ts` imports `@/lib/config` immediately after `import 'server-only'`
- [x] `middleware.ts` contains no reference to `lib/config`
- [x] `next.config.ts` contains all four security headers applied to `'/(.*)'`
- [x] `app/(public)/actions.ts` contains `EMAIL_REGEX` and the `else if` format check
- [x] `npx tsc --noEmit` exits with code 0
- [x] All three tasks committed individually with descriptive messages
