---
phase: 03-email-approval-workflow
plan: "05"
subsystem: testing
tags: [smoke-test, end-to-end, resend, supabase, next-js, approval-workflow]

# Dependency graph
requires:
  - phase: 03-email-approval-workflow
    plan: "02"
    provides: batch admin notification emails via submitRequest server action
  - phase: 03-email-approval-workflow
    plan: "03"
    provides: /api/approve GET route handler with idempotency and teacher emails
  - phase: 03-email-approval-workflow
    plan: "04"
    provides: /reviewed and /invalid landing pages

provides:
  - Phase 3 acceptance-tested and verified in live dev environment
  - All 5 smoke tests passed covering admin notification, approve, deny, idempotency, and invalid token flows
affects: [04-admin-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "APPROVAL_SECRET must be URL-encoded in approval link query params — encodeURIComponent() required for secrets containing special chars"

key-files:
  created: []
  modified:
    - app/(public)/actions.ts

key-decisions:
  - "APPROVAL_SECRET must be URL-encoded in approval URL — fix committed as fix(03): encode APPROVAL_SECRET in approval URL query params (210520d)"

requirements-completed: [REQ-03, EMAIL-02, APPR-01, APPR-02, APPR-03, APPR-04, EMAIL-03, EMAIL-04]

# Metrics
duration: ~5min
completed: 2026-03-12
---

# Phase 3 Plan 05: End-to-End Smoke Test Summary

**All 5 live smoke tests passed confirming admin notification emails, approve/deny DB transitions, idempotency guard, teacher confirmation emails, and invalid-token /invalid redirect all work correctly in the dev environment**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-12T02:57:55Z
- **Completed:** 2026-03-12T03:00:00Z
- **Tasks:** 2 (1 automated pre-flight, 1 human checkpoint)
- **Files modified:** 1 (bug fix)

## Accomplishments

- Pre-flight: `npm run lint` and `npm run build` passed cleanly before smoke test (0 errors, 1 pre-existing warning in middleware.ts unrelated to Phase 3)
- Test 1 (REQ-03, EMAIL-02): Admin notification email delivered via `resend.batch.send()` with correct teacher details, green Approve button, red Deny button, and correct subject line
- Test 2 (APPR-01, APPR-03, APPR-04, EMAIL-03): Approve link updated DB to `status=approved` with `reviewed_at` and `reviewed_by`, redirected to `/reviewed`, and teacher received approval email
- Test 3 (APPR-02): Second click on approval link showed `/reviewed` page with no duplicate teacher email and no DB change
- Test 4 (APPR-01, APPR-03, APPR-04, EMAIL-04): Deny link updated DB to `status=denied`, redirected to `/reviewed`, and teacher received denial email with dates and leave type
- Test 5 (APPR-01): Invalid token URL redirected to `/invalid` page — no server error, no DB change

## Task Commits

1. **Task 1: Pre-flight build verification** — no commit (verification only, no files changed)
2. **Task 2: Human smoke-test checkpoint** — approved by human (all 5 tests passed)

**Bug fix (found during smoke test):** `210520d` fix(03): encode APPROVAL_SECRET in approval URL query params

## Files Created/Modified

- `app/(public)/actions.ts` — Fixed: `APPROVAL_SECRET` now URL-encoded via `encodeURIComponent()` in approval link query params

## Decisions Made

- `APPROVAL_SECRET` must be URL-encoded in approval URLs — secrets may contain characters that break URL query param parsing without encoding. Fixed in `210520d`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] APPROVAL_SECRET not URL-encoded in approval link query params**
- **Found during:** Task 2 (human smoke test)
- **Issue:** `APPROVAL_SECRET` was embedded raw in the approval/deny URL query params. If the secret contains URL-unsafe characters (e.g., `+`, `=`, `/`, `&`), the token would be truncated or corrupted when the admin clicked the link, causing the route handler to reject it as invalid
- **Fix:** Wrapped `process.env.APPROVAL_SECRET` in `encodeURIComponent()` when constructing approval and denial URLs in `submitRequest`
- **Files modified:** `app/(public)/actions.ts`
- **Verification:** Smoke test re-run confirmed approve and deny links work correctly after fix
- **Committed in:** `210520d` fix(03): encode APPROVAL_SECRET in approval URL query params

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for correctness with non-alphanumeric APPROVAL_SECRET values. One-line change.

## Issues Encountered

None beyond the auto-fixed bug above.

## User Setup Required

None — all environment variables were already configured in `.env.local` from earlier phases. Smoke test requires `RESEND_API_KEY`, `ADMIN_EMAILS`, `APPROVAL_SECRET`, `RESEND_FROM`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_BASE_URL=http://localhost:3000`.

## Next Phase Readiness

- Phase 3 complete: all 8 requirements (REQ-03, EMAIL-02, APPR-01 through APPR-04, EMAIL-03, EMAIL-04) verified working in live environment
- Phase 4 (Admin Dashboard) is unblocked — the approval workflow it depends on is fully operational
- No outstanding blockers

---
*Phase: 03-email-approval-workflow*
*Completed: 2026-03-12*
