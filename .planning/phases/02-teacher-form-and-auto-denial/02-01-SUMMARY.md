---
phase: 02-teacher-form-and-auto-denial
plan: "01"
subsystem: api
tags: [next.js, supabase, resend, server-action, email, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: lib/supabase/server.ts createClient(), lib/email/send.ts sendEmail(), types/database.ts LeaveType/RequestStatus

provides:
  - submitRequest server action with full validation, DB insert, conditional email, and redirect
  - FormState type for useActionState integration in Plan 02 form UI
  - autoDenialTemplate HTML email generator for blackout auto-denial
  - lib/email/templates/ directory established for future email templates

affects:
  - 02-teacher-form-and-auto-denial (Plan 02 form UI imports FormState and submitRequest)
  - 03-admin-email-notification (admin email template pattern established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server action with prevState + formData signature for useActionState compatibility
    - redirect() placed outside try/catch to allow NEXT_REDIRECT to propagate
    - FormData is_blackout compared with === 'true' string (never Boolean() coercion)
    - Date parsing with T00:00:00 suffix to avoid UTC off-by-one in US timezones
    - Auto-denial email sent only after successful DB insert (not before)
    - Pure template functions in lib/email/templates/ (no server-only import needed)

key-files:
  created:
    - app/(public)/actions.ts
    - lib/email/templates/auto-denial.ts
  modified:
    - types/database.ts

key-decisions:
  - "FormState includes values field to restore form inputs after server-side validation failure (Next.js 15 resets uncontrolled inputs after server action)"
  - "outcome variable captured before try/catch so redirect() can execute outside try/catch block"
  - "autoDenialTemplate has no server-only import — pure function, imported by server-only actions.ts"
  - "[Rule 1 - Bug] types/database.ts updated to add Relationships:[] to table entries and Views/Functions keys — required by supabase-js v2.99 GenericSchema constraint"

patterns-established:
  - "Pattern 1: Email templates as pure functions in lib/email/templates/ — no server-only, pure string return, editable independently"
  - "Pattern 2: Server action validation collects all field errors before returning (not fail-fast) to show all issues at once"
  - "Pattern 3: is_blackout as explicit string comparison (=== 'true') because all FormData values are strings"

requirements-completed: [FORM-01, FORM-02, FORM-03, FORM-04, REQ-01, REQ-02, EMAIL-01]

# Metrics
duration: 5min
completed: "2026-03-11"
---

# Phase 2 Plan 01: Server Action and Auto-Denial Email Template Summary

**submitRequest server action with 6-field validation, conditional Supabase insert, blackout auto-denial email via Resend, and NEXT_REDIRECT-safe redirect; autoDenialTemplate pure HTML generator with inline CSS and local date formatting**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T04:51:12Z
- **Completed:** 2026-03-11T04:56:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `app/(public)/actions.ts` as the authoritative server-side contract for the teacher form — exports `submitRequest` and `FormState` type that Plan 02 will consume
- Created `lib/email/templates/auto-denial.ts` as a pure HTML template function with warm tone, inline CSS, and UTC-safe date formatting
- Fixed `types/database.ts` to conform to `@supabase/supabase-js` v2.99 `GenericSchema` requirement (added `Relationships: []` and `Views`/`Functions` keys)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auto-denial email template** - `1369354` (feat)
2. **Task 2: Create submitRequest server action** - `1672e3f` (feat)

**Plan metadata:** (created in this step)

## Files Created/Modified

- `lib/email/templates/auto-denial.ts` - Pure HTML email template function for blackout auto-denial; exports `autoDenialTemplate` and `AutoDenialTemplateArgs`
- `app/(public)/actions.ts` - `submitRequest` server action with validation, Supabase insert, conditional email, and redirect; exports `FormState` type
- `types/database.ts` - Added `Relationships: []` to `requests` and `blackout_dates` tables; added `Views` and `Functions` keys to `public` schema to satisfy `supabase-js` v2.99 `GenericSchema` constraint

## Decisions Made

- `FormState` includes a `values` field so the form UI can restore submitted field values via `defaultValue` after a server-side validation failure. Next.js 15 resets uncontrolled inputs after any server action completes, causing data loss without this.
- `outcome` variable is declared before the `try` block and set inside it, so `redirect(\`/confirmation?status=${outcome}\`)` executes outside `try/catch`. This ensures `NEXT_REDIRECT` (thrown internally by `redirect()`) is never swallowed.
- `autoDenialTemplate` is a pure function with no `'server-only'` import — it has no I/O and returns a plain string. The importing file (`actions.ts`) carries the server boundary.
- All date strings are parsed with `T00:00:00` appended to force local-time interpretation and avoid UTC midnight off-by-one on US timezones.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed types/database.ts to satisfy supabase-js v2.99 GenericSchema constraint**
- **Found during:** Task 2 (Create submitRequest server action)
- **Issue:** `@supabase/supabase-js` v2.99 requires that each table entry in the `Database` type include a `Relationships` field (typed as an array) for the table to extend `GenericTable`. Without it, the `Schema` type parameter resolves to `never`, causing the `.from('requests').insert({...})` call to reject all arguments with TypeScript error TS2769. The `public` schema also needed `Views` and `Functions` keys to extend `GenericSchema`.
- **Fix:** Added `Relationships: []` to `requests` and `blackout_dates` table entries; added `Views: Record<string, never>` and `Functions: Record<string, never>` to `public` schema
- **Files modified:** `types/database.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors; `npm run build` succeeds
- **Committed in:** `1672e3f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in pre-existing type stubs)
**Impact on plan:** Required for TypeScript correctness. No scope creep — same tables and schema, just missing fields required by the installed library version.

## Issues Encountered

The handwritten `types/database.ts` stub from Phase 1 was written against an older `@supabase/supabase-js` type contract. Version 2.99 added `Relationships` as a required field on `GenericTable` and requires `Views`/`Functions` on `GenericSchema`. The TypeScript error was caught during Task 2 verification and fixed inline.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `submitRequest` and `FormState` are ready to import in Plan 02 (teacher form UI)
- The `FormState.values` field enables form restoration on validation failure without any additional work in the UI
- `autoDenialTemplate` is standalone and can be edited independently of the action logic
- `lib/email/templates/` directory established for Phase 3 admin notification templates

---
*Phase: 02-teacher-form-and-auto-denial*
*Completed: 2026-03-11*
