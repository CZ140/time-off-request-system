---
phase: 02-teacher-form-and-auto-denial
plan: "02"
subsystem: ui
tags: [next.js, react, useActionState, tailwind, server-component, client-component]

# Dependency graph
requires:
  - phase: 02-teacher-form-and-auto-denial
    provides: submitRequest server action, FormState type (from Plan 01)

provides:
  - Teacher submission form at / — Client Component with useActionState, 8 fields, inline errors
  - Shared confirmation/denial page at /confirmation — Server Component with awaited searchParams

affects:
  - Phase 3+ (form is the entry point for all teacher submissions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useActionState(submitRequest, initialState) for progressive-enhancement server action forms
    - defaultValue on all text/date/textarea inputs to restore values after server validation failure
    - Local useState tracks is_blackout selection for amber inline warning (client-side UX, not form state)
    - searchParams typed as Promise<{ status?: string }> and awaited — Next.js 15 requirement
    - fieldset + legend for radio groups (accessible grouping without extra wrapper div)
    - Resend instantiation deferred to inside sendEmail() — avoids module-level crash when RESEND_API_KEY is absent at build time

key-files:
  created:
    - app/(public)/confirmation/page.tsx
  modified:
    - app/(public)/page.tsx
    - lib/email/send.ts

key-decisions:
  - "useActionState destructures [state, formAction, pending] — pending used to disable submit button and show Submitting... text, satisfying FORM-03 no-double-submit requirement"
  - "No defaultChecked restoration for is_blackout field — the field is a quick re-selection and the values field in FormState does not include is_blackout to avoid type mismatch"
  - "[Rule 1 - Bug] Resend instantiation moved inside sendEmail() to defer API key access to runtime — top-level new Resend() threw Missing API key during npm run build when RESEND_API_KEY was empty"

patterns-established:
  - "Pattern 1: noValidate on form element disables native browser validation UI so inline React errors are the sole feedback mechanism"
  - "Pattern 2: fieldset + legend for radio groups (leave type, blackout) — semantic and accessible without extra markup"
  - "Pattern 3: Server Components reading searchParams must type as Promise<...> and await — Next.js 15 requirement"

requirements-completed: [FORM-01, FORM-02, FORM-03, FORM-04, FORM-05]

# Metrics
duration: 8min
completed: "2026-03-11"
---

# Phase 2 Plan 02: Teacher Submission Form and Confirmation Page Summary

**Full-page teacher form (useActionState, 8 fields, per-field inline errors, submit lock) and shared confirmation/denial Server Component reading awaited searchParams — complete end-user flow for Phase 2**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-11T04:58:44Z
- **Completed:** 2026-03-11T05:07:00Z
- **Tasks:** 2 auto (Task 3 is checkpoint:human-verify — paused)
- **Files modified:** 3

## Accomplishments

- Built `app/(public)/page.tsx` as a full Client Component using `useActionState` — all 8 fields in locked order, 7 leave-type radios, blackout Yes/No with amber inline warning, per-field error display, defaultValue restoration from FormState.values, disabled submit with loading text
- Built `app/(public)/confirmation/page.tsx` as an async Server Component that awaits `searchParams` (Next.js 15 requirement) and renders two distinct variants: green checkmark success and amber warning auto-denial
- Fixed `lib/email/send.ts` to defer Resend instantiation inside `sendEmail()` so build does not crash when `RESEND_API_KEY` is empty

## Task Commits

Each task was committed atomically:

1. **Task 1: Build teacher submission form** - `a5446e2` (feat)
2. **Task 2: Build shared confirmation page** - `3f24505` (feat)

**Plan metadata:** (created in this step)

## Files Created/Modified

- `app/(public)/page.tsx` - Full teacher form Client Component; exports `TeacherFormPage`; consumes `submitRequest` and `FormState` from Plan 01's actions.ts
- `app/(public)/confirmation/page.tsx` - Shared confirmation/denial Server Component; awaits `searchParams`; renders success or auto-denial variant based on `status` param
- `lib/email/send.ts` - Moved `new Resend()` inside `sendEmail()` to defer API key access to runtime

## Decisions Made

- `useActionState` is destructured as `[state, formAction, pending]` — `pending` drives both the button's `disabled` attribute and its label text ("Submitting..." vs "Submit Request"), satisfying FORM-03.
- The `is_blackout` field is not restored via `defaultChecked` after a failed submission — it is not included in `FormState.values` (would require a type change to actions.ts) and the Yes/No re-selection is trivial for the teacher.
- Local `useState<string | null>(null)` tracks the selected blackout value client-side for the amber warning — this is purely a UX affordance and does not feed into form submission state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved Resend instantiation inside sendEmail() to prevent build-time crash**
- **Found during:** Task 1 verification (npm run build)
- **Issue:** `lib/email/send.ts` called `new Resend(process.env.RESEND_API_KEY!)` at module level. When `RESEND_API_KEY` is absent (empty string in .env.local), Resend's constructor throws `Missing API key`. Next.js evaluates server modules during `npm run build` page-data collection, causing a hard build failure: `Error: Failed to collect page data for /`.
- **Fix:** Removed the module-level `const resend = new Resend(...)` and moved instantiation inside `sendEmail()` so the API key is only accessed at runtime when the function is actually called.
- **Files modified:** `lib/email/send.ts`
- **Verification:** `npm run build` completes successfully; `/confirmation` correctly shows as `ƒ (Dynamic)` in build output.
- **Committed in:** `a5446e2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in pre-existing email wrapper)
**Impact on plan:** Required for build correctness. No scope creep — same sendEmail() signature and behavior, instantiation timing only.

## Issues Encountered

`lib/email/send.ts` instantiated the Resend client at module level with a non-null assertion (`!`). This pattern is common in tutorials but fails during Next.js static analysis when env vars are empty. The fix (defer to runtime) is the recommended pattern for any client SDK that validates its key in the constructor.

## User Setup Required

None - no external service configuration required. (RESEND_API_KEY and Supabase keys must be populated in .env.local before running the dev server or testing form submissions end-to-end — this is existing setup from Phase 1.)

## Next Phase Readiness

- Task 3 is a `checkpoint:human-verify` — awaiting human sign-off on the complete Phase 2 flow
- Once approved: Phase 3 (admin email notification) can begin; the form and confirmation pages are the stable entry point
- The `lib/email/templates/` directory established in Plan 01 is ready for the admin notification template

---
*Phase: 02-teacher-form-and-auto-denial*
*Completed: 2026-03-11*
