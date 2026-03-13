---
phase: 05-polish-and-pre-launch-hardening
plan: 01
subsystem: api
tags: [supabase, server-actions, error-handling, next-js]

# Dependency graph
requires:
  - phase: 02-teacher-form-and-auto-denial
    provides: submitRequest server action in actions.ts
  - phase: 04-admin-dashboard
    provides: admin dashboard page.tsx with Supabase data fetch
provides:
  - Duplicate submission guard (60s window) in submitRequest via .maybeSingle()
  - Admin dashboard try/catch error fallback with inline "Unable to load data. Please refresh." UI
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - supabase .maybeSingle() for zero-or-one duplicate check (not .single() which errors on no match)
    - Supabase error values converted to thrown exceptions with explicit reqErr/bdErr check before catch fires
    - try/catch in async Server Component for graceful DB error fallback

key-files:
  created: []
  modified:
    - app/(public)/actions.ts
    - app/(admin)/admin/(protected)/page.tsx

key-decisions:
  - "supabase createClient() moved before try/catch in submitRequest so duplicate guard and insert share one client instance"
  - ".maybeSingle() used for duplicate check — .single() throws when zero rows match, breaking the no-duplicate path"
  - "Supabase returns errors as values not exceptions — if (reqErr || bdErr) throw new Error('db') required to trigger catch"
  - "fetchError flag renders inline error paragraph rather than crashing; TabSwitcher receives empty arrays (already handles that state)"

patterns-established:
  - "Pattern: redirect() outside try/catch in server actions — NEXT_REDIRECT must not be swallowed by catch block"
  - "Pattern: Supabase error value → thrown exception conversion for async Server Component error boundaries"

requirements-completed: [REQ-01, ADMIN-03]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 5 Plan 01: Server-Side Hardening Summary

**Duplicate submission guard via .maybeSingle() 60-second window check in submitRequest, and admin dashboard try/catch fallback rendering inline error message instead of 500**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T20:27:46Z
- **Completed:** 2026-03-13T20:28:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added pre-insert duplicate check to submitRequest: queries for matching teacher_email + start_date + end_date submitted within the last 60 seconds; redirects to /confirmation if found, preventing duplicate DB rows
- Added try/catch around the admin dashboard Promise.all fetch, converting Supabase error values to exceptions and setting a fetchError flag
- Added inline "Unable to load data. Please refresh." error paragraph in admin dashboard JSX, displayed when fetchError is true

## Task Commits

Each task was committed atomically:

1. **Task 1: Add duplicate submission guard to submitRequest** - `e4b1822` (feat)
2. **Task 2: Add try/catch error fallback to admin dashboard page** - `683061d` (feat)

**Plan metadata:** (docs commit, see below)

## Files Created/Modified
- `app/(public)/actions.ts` - Duplicate guard block added between status assignment and try/catch insert block; supabase client hoisted before try
- `app/(admin)/admin/(protected)/page.tsx` - Promise.all wrapped in try/catch with fetchError flag; inline error paragraph added to JSX

## Decisions Made
- Moved `const supabase = createClient()` before the try block in submitRequest so both the duplicate check query and the insert share the same client instance without re-instantiating
- Used `.maybeSingle()` not `.single()` — `.single()` returns an error when zero rows match, which would incorrectly treat "no duplicate found" as a failure
- Admin dashboard uses a simple `fetchError` boolean flag rather than React Error Boundary — try/catch in an async Server Component function is the correct pattern for Next.js

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both hardening changes are self-contained and do not affect shared files or interfaces
- Ready for remaining Phase 5 plans (environment audit, smoke testing, etc.)

## Self-Check: PASSED

- FOUND: app/(public)/actions.ts
- FOUND: app/(admin)/admin/(protected)/page.tsx
- FOUND: .planning/phases/05-polish-and-pre-launch-hardening/05-01-SUMMARY.md
- FOUND commit e4b1822 (Task 1)
- FOUND commit 683061d (Task 2)

---
*Phase: 05-polish-and-pre-launch-hardening*
*Completed: 2026-03-13*
