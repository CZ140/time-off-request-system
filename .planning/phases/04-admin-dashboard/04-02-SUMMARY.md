---
phase: 04-admin-dashboard
plan: 02
subsystem: ui
tags: [react, next.js, supabase, tailwind, typescript]

# Dependency graph
requires:
  - phase: 04-01
    provides: admin auth middleware, (protected) route group, login page
  - phase: 03-email-approval-workflow
    provides: formatDate and LEAVE_TYPE_LABELS from lib/email/utils.ts
provides:
  - Admin dashboard server page fetching requests + blackout_dates via Promise.all
  - TabSwitcher client component with Requests / Blackout Dates tabs
  - RequestsTab client component with status filter pills and sortable 10-column table
  - Color-coded status badges (yellow/green/red/gray)
  - BlackoutDatesTab placeholder stub
  - actions.ts stub for logout and blackout date actions
affects:
  - 04-03 (will replace BlackoutDatesTab stub and implement actions.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server component fetches data via Promise.all and casts supabase {} results to explicit Row types
    - Client components receive typed arrays as props — no client-side fetching
    - Filter state uses DB literal values (not display strings) to match RequestStatus union
    - Null-safe sort using String(value ?? '') to avoid TypeError on nullable columns

key-files:
  created:
    - app/(admin)/admin/_components/RequestsTab.tsx
    - app/(admin)/admin/_components/TabSwitcher.tsx
    - app/(admin)/admin/_components/BlackoutDatesTab.tsx
    - app/(admin)/admin/actions.ts
  modified:
    - app/(admin)/admin/(protected)/page.tsx

key-decisions:
  - "Supabase query results cast to explicit RequestRow[]/BlackoutDateRow[] via 'as' keyword — same {} inference issue as Phase 03"
  - "Filter state values use RequestStatus DB literals ('auto_denied'), not display strings ('Auto-Denied') — prevents filter mismatch"
  - "Null-safe sort: String(value ?? '') handles nullable reason and reviewed_by columns without TypeError"
  - "actions.ts stub created in Plan 02 so page.tsx compiles; Plan 03 will overwrite with full implementations"

patterns-established:
  - "Pattern: Server component fetches, client component receives typed props — clean server/client boundary"
  - "Pattern: Filter pill values must equal DB enum literals exactly to match row.status comparison"

requirements-completed: [ADMIN-03, ADMIN-04, ADMIN-05]

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 4 Plan 02: Admin Dashboard Requests Table Summary

**Server-side data fetching dashboard with client-side filter pills (5 status options) and sortable 10-column requests table with color-coded status badges**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T04:07:33Z
- **Completed:** 2026-03-13T04:15:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Admin dashboard server page fetches requests + blackout_dates in parallel via Promise.all and passes typed arrays to client components
- TabSwitcher client component manages Requests / Blackout Dates tab state with styled active indicators
- RequestsTab delivers 10-column sortable table with status filter pills using DB literal values and null-safe sort

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin dashboard server page with tab shell** - `9e454be` (feat)
2. **Task 2: Build RequestsTab with filter pills and sortable table** - `49ce1ea` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/(admin)/admin/(protected)/page.tsx` - Async server component: fetches requests + blackout_dates, renders header with logout, passes data to TabSwitcher
- `app/(admin)/admin/_components/TabSwitcher.tsx` - Client component: Requests / Blackout Dates tab navigation with active state
- `app/(admin)/admin/_components/RequestsTab.tsx` - Client component: filter pills + 10-column sortable table with status badges
- `app/(admin)/admin/_components/BlackoutDatesTab.tsx` - Placeholder stub for Plan 03
- `app/(admin)/admin/actions.ts` - Stub server actions for Plan 03 (logoutAdmin, addBlackoutDate, deleteBlackoutDate)

## Decisions Made
- Supabase query results cast to explicit `RequestRow[]`/`BlackoutDateRow[]` using `as` — TypeScript infers `{}[]` without this, same pattern needed as in Phase 03
- Filter pill values strictly match `RequestStatus` DB literals (`'auto_denied'`), not display strings — prevents filter comparison mismatch (Pitfall 6 from plan)
- `String(value ?? '')` for sort comparisons — safely handles nullable `reason` and `reviewed_by` columns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed supabase-js {} type inference in page.tsx**
- **Found during:** Task 2 verification (npm run build)
- **Issue:** TypeScript inferred `{}[]` from `.select('*')` calls without explicit generics; `requests ?? []` had type `{}[]` incompatible with `RequestRow[]` expected by TabSwitcher
- **Fix:** Destructure raw results into separate vars, then cast: `const requests = (requestsRaw ?? []) as RequestRow[]`
- **Files modified:** `app/(admin)/admin/(protected)/page.tsx`
- **Verification:** `npm run build` exits 0 after fix
- **Committed in:** `49ce1ea` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for build to pass. Same pattern as Phase 03 supabase inference fix. No scope creep.

## Issues Encountered
- Supabase-js v2 `.select('*')` inference produces `{}[]` in TypeScript — consistent pattern across all phases; explicit cast is the established fix

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dashboard shell, tab switching, and requests table all complete
- Plan 03 can replace `BlackoutDatesTab.tsx` stub and implement `actions.ts` (logoutAdmin, addBlackoutDate, deleteBlackoutDate)
- All ADMIN-03, ADMIN-04, ADMIN-05 requirements satisfied

---
*Phase: 04-admin-dashboard*
*Completed: 2026-03-13*
