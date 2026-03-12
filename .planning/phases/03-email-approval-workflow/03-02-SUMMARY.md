---
phase: 03-email-approval-workflow
plan: "02"
subsystem: email
tags: [resend, batch-send, server-action, next-js, typescript]

# Dependency graph
requires:
  - phase: 03-email-approval-workflow
    plan: "01"
    provides: adminNotificationTemplate from lib/email/templates/admin-notification.ts
  - phase: 01-foundation
    provides: createClient (Supabase server client)
  - phase: 02-teacher-form-and-auto-denial
    provides: submitRequest server action pattern, sendEmail wrapper
provides:
  - app/(public)/actions.ts — updated submitRequest with batch admin notification for non-blackout submissions
  - .env.example — NEXT_PUBLIC_BASE_URL documented for approval link generation
affects: [03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resend instantiated inside function body to defer API key access to runtime (prevents build-time throw)"
    - "resend.batch.send() for multi-recipient admin emails — one email object per admin with unique approve/deny URLs"
    - "ADMIN_EMAILS parsed with .split(',').map(e => e.trim()).filter(Boolean) for safe whitespace and empty-string handling"
    - "Supabase insert chains .select('id').single() to return inserted row id for URL construction"

key-files:
  created: []
  modified:
    - app/(public)/actions.ts
    - .env.example

key-decisions:
  - "Resend instantiated inside submitRequest (not at module scope) — mirrors existing sendEmail() pattern that fixed build-time RESEND_API_KEY throw in Phase 02"
  - "batch.send() errors bubble to the outer catch block — no inner try/catch wrapping that would swallow email failures"
  - "NEXT_PUBLIC_ prefix is intentional — the app's public URL is not secret and documented as such in .env.example"
  - "redirect() remains outside try/catch — preserves NEXT_REDIRECT throw behavior established in Phase 02"

requirements-completed: [REQ-03, EMAIL-02]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 3 Plan 02: Batch Admin Notification Summary

**submitRequest server action updated to batch-send tokenized Approve/Deny admin emails via Resend for every successful non-blackout DB insert**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T02:51:23Z
- **Completed:** 2026-03-12T02:53:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `NEXT_PUBLIC_BASE_URL` to `.env.example` with dev default and production guidance
- Updated Supabase insert to chain `.select('id').single()` — returns inserted row id for embedding in approval URLs
- Added `!is_blackout` block in `submitRequest` that calls `resend.batch.send()` with one email per admin address, each containing unique approve/deny URLs with `encodeURIComponent(adminEmail)` and `inserted.id`
- ADMIN_EMAILS parsing uses `.split(',').map(e => e.trim()).filter(Boolean)` for safe multi-address handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Update .env.example — add NEXT_PUBLIC_BASE_URL** - `5096773` (chore)
2. **Task 2: Update submitRequest — send batch admin notification for non-blackout requests** - `6f681cc` (feat)

## Files Created/Modified

- `app/(public)/actions.ts` — Updated submitRequest: new Resend/adminNotificationTemplate imports, .select('id').single() on insert, !is_blackout batch send block
- `.env.example` — Added NEXT_PUBLIC_BASE_URL in Approval Workflow section with dev/production guidance

## Decisions Made

- Resend instantiated inside the function body (not module scope) to defer API key access to runtime — mirrors the existing sendEmail() fix from Phase 02 that resolved build-time throws with empty RESEND_API_KEY
- Batch send errors intentionally not wrapped in inner try/catch — failures bubble to the outer catch that returns a user-facing error message
- NEXT_PUBLIC_ prefix acknowledged as intentional — app's public URL is not secret; comment in .env.example explains the exception to SEC-02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Set `NEXT_PUBLIC_BASE_URL` in `.env.local`:
- Development: `http://localhost:3000`
- Production: your Vercel deployment URL (e.g. `https://your-app.vercel.app`)

## Next Phase Readiness

- Wave 2 unblocked: `submitRequest` now sends admin notification emails on non-blackout submissions
- Plan 03-03 (approve/deny API route) can be executed — it will consume `approvalConfirmationTemplate` and `denialConfirmationTemplate` from Plan 01
- Build is green (`tsc --noEmit` passes with zero errors)

---
*Phase: 03-email-approval-workflow*
*Completed: 2026-03-11*

## Self-Check: PASSED

- FOUND: app/(public)/actions.ts
- FOUND: .env.example
- FOUND: .planning/phases/03-email-approval-workflow/03-02-SUMMARY.md
- Commit 5096773 verified
- Commit 6f681cc verified
- `resend.batch.send(batch)` present in actions.ts
- `NEXT_PUBLIC_BASE_URL` present in .env.example
- `!is_blackout` gate present in actions.ts
- `encodeURIComponent(adminEmail)` present in approval/deny URLs
