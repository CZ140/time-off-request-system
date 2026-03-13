---
phase: 05-polish-and-pre-launch-hardening
plan: 02
subsystem: ops
tags: [security, scripts, env, dns, pre-deploy]

# Dependency graph
requires:
  - phase: 05-polish-and-pre-launch-hardening
    plan: 01
    provides: Duplicate guard and admin error fallback (hardening tasks)
provides:
  - scripts/check-bundle-secrets.sh - pre-deploy bundle secret leak detection
  - .env.example Resend DNS SPF/DKIM pre-launch checklist
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - grep .next/static --include="*.js" for client bundle secret name scanning
    - FOUND=0 flag accumulates all secret failures before exit 1 (no early bail-out)
    - Shell set -euo pipefail with explicit exit code semantics (0=safe, 1=leak)

key-files:
  created:
    - scripts/check-bundle-secrets.sh
  modified:
    - .env.example

key-decisions:
  - "Grep targets .next/static only (not .next/ root) — .next/server/ legitimately contains secret names in server-side code"
  - "FOUND flag mechanism checks all secrets before exiting so operator sees every leaked name in one run"
  - "Resend DNS checklist inserted as comments in .env.example — co-located with RESEND_* variables for discoverability"

patterns-established:
  - "Pattern: pre-deploy bundle scan script greps .next/static only, not .next/ root"

requirements-completed: [SEC-01, SEC-02, EMAIL-02]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 5 Plan 02: Bundle Security Check and Resend DNS Checklist Summary

**Bundle secret leak detection script (scripts/check-bundle-secrets.sh) verifying .next/static is clean, plus SPF/DKIM DNS pre-launch checklist in .env.example**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-13T20:30:12Z
- **Completed:** 2026-03-13T20:45:00Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 2

## Accomplishments

- Created `scripts/check-bundle-secrets.sh`: builds the project, then greps `.next/static` JS files for SUPABASE_SERVICE_ROLE_KEY, APPROVAL_SECRET, ADMIN_PASSWORD, and RESEND_API_KEY; exits 0 on clean, exits 1 on leak with named secret in output
- Script verified: ran full build + scan, exited 0 with "PASS: No secret names found in client bundle."
- Added Resend DNS pre-launch checklist to `.env.example` after `RESEND_FROM` line with SPF TXT record value, DKIM host instructions, and Resend dashboard verification steps

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bundle secret verification script** - `797dc6c` (chore)
2. **Task 2: Add Resend DNS pre-launch checklist to .env.example** - `41ee6b5` (docs)
3. **Task 3: Final smoke test — verify all phase 5 success criteria** - `83652c3` (chore)

## Files Created/Modified

- `scripts/check-bundle-secrets.sh` - Pre-deploy gate script; greps .next/static only; exits 0=safe, 1=leak
- `.env.example` - Resend DNS checklist block (lines 28-41) inserted after RESEND_FROM, before Approval Workflow section

## Decisions Made

- Script greps `.next/static` only, not `.next/` root — server bundle legitimately contains secret variable names in server-side code; only the client bundle (static) is the security boundary
- FOUND accumulator flag lets all secrets be checked before exiting non-zero, so operator sees every leaked name in one scan
- Resend checklist placed as comments in `.env.example` co-located with the RESEND_* variables for natural discoverability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - the Resend DNS checklist documents what the deployer needs to configure externally (SPF/DKIM at domain registrar), but no new env vars or service credentials are required beyond what was already in .env.example.

## Phase 5 Complete — All Success Criteria Verified

All 5 phase 5 success criteria confirmed by manual smoke test (user-approved):

1. Admin requests table empty state — "No requests found." renders correctly
2. Styled HTML buttons in admin notification emails — pre-existing green/red anchor buttons confirmed
3. Resend DNS documentation — SPF/DKIM checklist in .env.example confirmed
4. Bundle secret verification — check-bundle-secrets.sh exits 0 on clean build
5. Duplicate submission guard — only 1 row inserted on re-submit within 60 seconds

The application is ready for production deployment.

## Self-Check: PASSED

- FOUND: scripts/check-bundle-secrets.sh
- FOUND: .env.example (contains SPF)
- FOUND commit 797dc6c (Task 1)
- FOUND commit 41ee6b5 (Task 2)
- FOUND commit 83652c3 (Task 3)

---
*Phase: 05-polish-and-pre-launch-hardening*
*Completed: 2026-03-13*
