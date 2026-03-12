---
phase: 03-email-approval-workflow
plan: "01"
subsystem: email
tags: [resend, html-email, typescript, email-templates]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: LeaveType and RequestStatus types from types/database.ts
  - phase: 02-teacher-form-and-auto-denial
    provides: established auto-denial email template pattern (inline CSS, card layout)
provides:
  - lib/email/utils.ts — shared formatDate helper and LEAVE_TYPE_LABELS map
  - lib/email/templates/admin-notification.ts — admin notification with Approve/Deny buttons
  - lib/email/templates/approval-confirmation.ts — minimal teacher approval confirmation
  - lib/email/templates/denial-confirmation.ts — teacher denial confirmation with dates
affects: [03-02, 03-03, wave-2-all]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure HTML email templates as TypeScript functions returning strings (no React Email)"
    - "Shared utils module prevents duplication of formatDate and LEAVE_TYPE_LABELS across templates"
    - "T00:00:00 suffix on ISO date strings forces local timezone parsing, preventing off-by-one-day bug in US timezones"

key-files:
  created:
    - lib/email/utils.ts
    - lib/email/templates/admin-notification.ts
    - lib/email/templates/approval-confirmation.ts
    - lib/email/templates/denial-confirmation.ts
  modified: []

key-decisions:
  - "utils.ts is the canonical source for formatDate and LEAVE_TYPE_LABELS; auto-denial.ts keeps its own local copies (not modified)"
  - "Admin notification template has no is_blackout field — only called for non-blackout requests"
  - "Approval email is zero-args and minimal — no dates, leave type, or admin attribution"
  - "Denial email echoes dates and leave type but includes no next-steps guidance — denial is final"
  - "Reason field in admin notification always rendered — shows (none provided) when null"

patterns-established:
  - "Pure template functions: no server-only import, no I/O — all side-effects happen in callers"
  - "Inline CSS only — email clients strip class attributes and style tags"
  - "600px max-width card on #f3f4f6 gray background, white card with #e5e7eb border"
  - "Action buttons as anchor tags with explicit padding, border-radius 6px, font-weight 600, display inline-block"

requirements-completed: [EMAIL-02, EMAIL-03, EMAIL-04]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 3 Plan 01: Email Templates Summary

**Four email template files — shared utils module plus admin notification (Approve/Deny buttons), teacher approval, and teacher denial confirmation — ready for Wave 2 import**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T02:44:51Z
- **Completed:** 2026-03-12T02:49:13Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created shared `lib/email/utils.ts` exporting `formatDate` and `LEAVE_TYPE_LABELS` — single canonical source for all Phase 3 templates
- Built `admin-notification.ts` with full teacher details table and styled Approve/Deny anchor-tag buttons (green/red)
- Built `approval-confirmation.ts` (zero-args, minimal) and `denial-confirmation.ts` (echoes dates and leave type, no next steps)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/email/utils.ts** - `c03e968` (feat)
2. **Task 2: Create admin-notification.ts** - `a910f6a` (feat)
3. **Task 3: Create approval-confirmation.ts and denial-confirmation.ts** - `c1d58a2` (feat)

## Files Created/Modified

- `lib/email/utils.ts` — Shared formatDate helper and LEAVE_TYPE_LABELS map for all Phase 3 templates
- `lib/email/templates/admin-notification.ts` — Admin email with teacher details table and Approve/Deny buttons; exports AdminNotificationTemplateArgs
- `lib/email/templates/approval-confirmation.ts` — Minimal teacher approval confirmation; no args
- `lib/email/templates/denial-confirmation.ts` — Teacher denial email echoing dates and leave type; exports DenialConfirmationTemplateArgs

## Decisions Made

- `auto-denial.ts` was intentionally left unmodified — it keeps its own local copies of formatDate and LEAVE_TYPE_LABELS per plan specification
- Admin notification template omits `is_blackout` field because it is only called for non-blackout pending requests
- Approval email takes no arguments to keep it simple and prevent leaking admin identity
- Denial email tone: respectful and direct, acknowledges request, states denial, no contact suggestion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four files TypeScript-clean (`npm run build` passes with zero errors)
- Wave 2 plans (03-02, 03-03) can import templates with no further discovery needed
- `adminNotificationTemplate` is ready for use in the updated `submitRequest` action
- `approvalConfirmationTemplate` and `denialConfirmationTemplate` are ready for the `/api/approve` route handler

---
*Phase: 03-email-approval-workflow*
*Completed: 2026-03-11*

## Self-Check: PASSED

- FOUND: lib/email/utils.ts
- FOUND: lib/email/templates/admin-notification.ts
- FOUND: lib/email/templates/approval-confirmation.ts
- FOUND: lib/email/templates/denial-confirmation.ts
- FOUND: .planning/phases/03-email-approval-workflow/03-01-SUMMARY.md
- Commit c03e968 verified
- Commit a910f6a verified
- Commit c1d58a2 verified
