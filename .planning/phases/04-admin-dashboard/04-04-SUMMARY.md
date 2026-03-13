---
phase: 04-admin-dashboard
plan: "04"
subsystem: ui
tags: [smoke-test, qa, admin-auth, next.js, supabase, iron-session, CVE-2025-29927]

# Dependency graph
requires:
  - phase: 04-01
    provides: admin auth middleware, dual-gate CVE-2025-29927 protection, login page
  - phase: 04-02
    provides: requests table with filter pills and sortable columns
  - phase: 04-03
    provides: blackout date CRUD server actions, logout action
provides:
  - "Phase 4 gate: all 8 ADMIN requirements verified working in running dev server"
  - "CVE-2025-29927 bypass test confirmed: curl with x-middleware-subrequest header returns 307 not 200"
  - "Clean production build: zero lint errors, zero TypeScript errors"
affects: [05-teacher-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "formatDate() must use new Date(iso).toLocaleDateString() for ISO timestamps — not plain date string parsing"

key-files:
  created: []
  modified:
    - "app/(admin)/admin/_components/RequestsTab.tsx"

key-decisions:
  - "submitted_at column stores ISO timestamp (2026-03-13T04:00:00Z), not a plain date string — formatDate() must parse via new Date() constructor"

patterns-established:
  - "Pattern: Smoke test gate confirms end-to-end flows before advancing to next phase — not a code review, a live verification"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08]

# Metrics
duration: "~5min"
completed: 2026-03-13
---

# Phase 4 Plan 04: Phase 4 Smoke Test and Gate Summary

**All 8 ADMIN requirements verified working end-to-end in running dev server; CVE-2025-29927 bypass confirmed blocked; one bug fixed during testing (submitted_at ISO timestamp parsing)**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-03-13
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Full 15-item smoke test checklist executed and approved — all ADMIN-01 through ADMIN-08 requirements confirmed working
- CVE-2025-29927 bypass attempt via `x-middleware-subrequest` curl header verified to return 307 redirect, not 200
- Build gate passed: `npm run lint` and `npm run build` both exit 0 with zero errors
- Bug found and fixed during smoke test: `submitted_at` column showed "Invalid Date" because `formatDate()` treated it as a plain date string instead of an ISO timestamp

## Task Commits

Each task was committed atomically:

1. **Task 1: Final build gate** — lint and build both pass (pre-existing per context)
2. **Task 2: Phase 4 smoke test — manual verification** — human-approved all 15 items

**Bug fix commit:** `d23a399` fix(04): parse submitted_at as ISO timestamp, not plain date string

## Files Created/Modified
- `app/(admin)/admin/_components/RequestsTab.tsx` — fixed `submitted_at` formatting to parse full ISO timestamp via `new Date()`

## Decisions Made
- `submitted_at` is stored in Supabase as a full ISO timestamp string (e.g., `2026-03-13T04:00:00Z`), not a plain `YYYY-MM-DD` date. The existing `formatDate()` helper was designed for plain date strings; the fix applies `new Date(isoString).toLocaleDateString('en-US', {...})` directly in RequestsTab instead of routing through the shared helper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed "Invalid Date" display for submitted_at column**
- **Found during:** Task 2 (Phase 4 smoke test — manual verification)
- **Issue:** `submitted_at` is a full ISO timestamp from Supabase, but `formatDate()` was designed to parse plain `YYYY-MM-DD` strings. Passing an ISO timestamp produced "Invalid Date" in the rendered table.
- **Fix:** Updated `RequestsTab.tsx` to parse `submitted_at` directly with `new Date(row.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` rather than calling `formatDate()`.
- **Files modified:** `app/(admin)/admin/_components/RequestsTab.tsx`
- **Verification:** Submitted column now shows readable dates (e.g., "Mar 13, 2026") in running dev server
- **Committed in:** `d23a399`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for ADMIN-05 date display correctness. No scope creep.

## Issues Encountered
- `formatDate()` utility was built for plain date strings (from `start_date`/`end_date` columns which Supabase returns as `YYYY-MM-DD`). The `submitted_at` column returns a full ISO timestamp — different format, same helper fails silently by producing "Invalid Date". Fixed at source in RequestsTab.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 gate fully passed — all 8 ADMIN requirements verified working
- CVE-2025-29927 dual-auth confirmed in live test
- Phase 5 (teacher view) can proceed immediately
- No known blockers

---
*Phase: 04-admin-dashboard*
*Completed: 2026-03-13*
