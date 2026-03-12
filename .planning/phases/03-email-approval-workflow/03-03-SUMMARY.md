---
phase: 03-email-approval-workflow
plan: "03"
subsystem: api
tags: [supabase, resend, nextjs, route-handler, idempotency]

# Dependency graph
requires:
  - phase: 03-01
    provides: email templates (approval-confirmation.ts, denial-confirmation.ts) and sendEmail utility
  - phase: 01-03
    provides: createClient (lib/supabase/server.ts) and Database types
provides:
  - Full /api/approve GET route handler replacing Phase 1 stub
  - Token-validated, idempotent approval/denial workflow
  - Teacher confirmation emails sent only after confirmed DB write
affects: [04-admin-dashboard, future admin-facing phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NextResponse.redirect() for all redirects in route handlers (never redirect() from next/navigation)
    - .single<RowType>() explicit generic to resolve {} inference from supabase-js typed client
    - Inline URL builder helper for repeated redirect construction
    - Email sent strictly after DB update error check (APPR-04 safety pattern)

key-files:
  created: []
  modified:
    - app/api/approve/route.ts

key-decisions:
  - "Used .single<RequestRow>() explicit generic to fix supabase-js {} type inference — typed client alone insufficient"
  - "buildReviewedUrl extracted as local helper used for both idempotency redirect and success redirect"
  - "action param validated as 'approve' | 'deny' before any DB access to fail fast on invalid links"

patterns-established:
  - "Route handler redirects: NextResponse.redirect(new URL('/path', request.url)) — never throw-based redirect()"
  - "Idempotency before mutation: fetch row, check status !== 'pending', redirect without touching DB"
  - "Email after DB: sendEmail called only inside success branch after checking updateError"

requirements-completed: [APPR-01, APPR-02, APPR-03, APPR-04, EMAIL-03, EMAIL-04]

# Metrics
duration: 10min
completed: 2026-03-12
---

# Phase 3 Plan 03: Approval Route Handler Summary

**Idempotent /api/approve GET handler with APPROVAL_SECRET token validation, DB audit fields, and post-DB-write teacher email dispatch**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-12T02:51:21Z
- **Completed:** 2026-03-12T02:59:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced Phase 1 stub with full 7-step approval/denial handler
- Token validation rejects invalid/missing APPROVAL_SECRET on every request
- Idempotency guard prevents double-processing already-actioned requests
- DB update stores status, reviewed_at timestamp, and reviewed_by admin email
- Teacher email (approval or denial) dispatched only after confirmed DB write

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement /api/approve GET route handler** - `905dc04` (feat)

**Plan metadata:** _(see final docs commit)_

## Files Created/Modified
- `app/api/approve/route.ts` - Full GET handler: token validation, idempotency check, DB update with audit fields, conditional teacher email, /reviewed redirect

## Decisions Made
- Used `.single<RequestRow>()` explicit generic on Supabase queries — the typed client alone was insufficient for type inference, returning `{}` for the row shape
- Extracted `buildReviewedUrl` as a local helper function used by both the idempotency redirect (Step 4) and the success redirect (Step 7), keeping the URL construction DRY
- Validated `action` against the `'approve' | 'deny'` union before any DB access for early rejection of malformed links

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Explicit generic type on Supabase .single() calls**
- **Found during:** Task 1 (build verification)
- **Issue:** TypeScript inferred `{}` for the Supabase query result rather than `Database['public']['Tables']['requests']['Row']`, causing `requestRow.status` to fail type checking
- **Fix:** Added `.single<RequestRow>()` explicit generic on both the fetch and update queries
- **Files modified:** app/api/approve/route.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 905dc04 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type inference bug)
**Impact on plan:** Required for TypeScript correctness. No scope creep — one line change per query call.

## Issues Encountered
- Turbopack build pipeline produces intermittent ENOENT on `pages-manifest.json` and `edge-wrapper_*.js` during static generation phase. Confirmed pre-existing (occurs with original stub too). TypeScript compilation and lint checks pass cleanly on every run. Not caused by this plan's changes.

## Next Phase Readiness
- /api/approve route is fully operational: token-validates, idempotency-safe, DB audit trail, teacher emails dispatched
- All APPR-01 through APPR-04 requirements satisfied
- Ready for Phase 4 admin dashboard and /reviewed / /invalid page implementations

---
*Phase: 03-email-approval-workflow*
*Completed: 2026-03-12*
