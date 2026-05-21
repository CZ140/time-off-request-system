---
phase: 6
plan: "06-03"
title: "Server-side blackout date enforcement"
requirements_addressed: [SEC-01]
completed: "2026-05-21"
tsc_passed: true
key-files:
  modified:
    - app/(public)/actions.ts
decisions:
  - "Same supabase client instance used for blackout check, duplicate guard, and insert — no second createClient() call"
  - "is_blackout form field still extracted and validated for UX; it is never used for security-critical status determination after this change"
  - "Fail-closed error handling: blackout query failure returns error response rather than falling through to insert with client-supplied value"
---

# Phase 6 Plan 03: Server-Side Blackout Date Enforcement Summary

**One-liner:** Server-side Supabase .lte/.gte overlap query replaces client-trusted is_blackout boolean, making blackout bypass via DevTools or Burp Suite impossible (SEC-01).

## What Was Built

### Files Modified

| File | Change |
|------|--------|
| `app/(public)/actions.ts` | Removed client-trusted status derivation; added blackout overlap query with fail-closed error handling; replaced all `is_blackout` references in email conditions and insert with `serverBlackout` |

## Exact Changes Made to actions.ts

### Removed (old client-trusted status line)

```typescript
  // 3. Determine status
  const status: RequestStatus = is_blackout ? 'auto_denied' : 'pending'
```

### Added (after `const supabase = createClient()`, before `const windowStart`)

```typescript
  // 3. Server-side blackout check — overrides the client-supplied is_blackout field (SEC-01).
  // A teacher who selects "No" on the blackout question for dates in the blackout table
  // is still auto-denied. The client value is never trusted for status determination.
  const { data: blackoutRows, error: blackoutError } = await supabase
    .from('blackout_dates')
    .select('id')
    .lte('start_date', end_date)   // blackout row starts on or before request end date
    .gte('end_date', start_date)   // blackout row ends on or after request start date
    .limit(1)                       // existence check only — one hit is enough

  if (blackoutError) {
    // Fail closed: if the blackout check fails, do not proceed.
    // Returning an error is safer than silently using the client-supplied value.
    return { message: 'Unable to verify blackout dates. Please try again.' }
  }

  const serverBlackout = (blackoutRows?.length ?? 0) > 0

  // Status is derived from the server-computed blackout result, not the form field.
  const status: RequestStatus = serverBlackout ? 'auto_denied' : 'pending'
```

### Updated insert (is_blackout column)

Before: `is_blackout,`
After:  `is_blackout: serverBlackout,`

### Updated auto-denial email condition

Before: `if (is_blackout) {`
After:  `if (serverBlackout) {`

### Updated admin notification condition

Before: `if (!is_blackout) {`
After:  `if (!serverBlackout) {`

## Scenario Verification

The updated logic was verified by tracing the modified file for all four scenarios:

| Scenario | Form is_blackout | DB query result | serverBlackout | status | Correct? |
|----------|-----------------|-----------------|----------------|--------|----------|
| A: Teacher selects Yes, dates ARE blackout | true | returns row | true | auto_denied | Yes |
| B: Teacher selects No, dates ARE blackout (attack case) | false | returns row | true | auto_denied | Yes — SEC-01 enforced |
| C: Teacher selects No, dates NOT blackout | false | empty | false | pending | Yes |
| D: Teacher selects Yes, dates NOT blackout (confused teacher) | true | empty | false | pending | Yes — server overrides self-report |

All four scenarios produce the correct status. Scenario B (the attack case) is the key fix: a teacher who manipulates `is_blackout=false` in DevTools or Burp Suite is still auto-denied because the server independently queries the blackout_dates table.

## Key Decisions Made

1. **Same supabase client instance** — The blackout query reuses the `createClient()` call already present for the duplicate guard. No second client instantiation needed. The query is inserted between `createClient()` and `const windowStart`.

2. **is_blackout form field retained for validation** — The form field is still extracted and validated ("Please indicate whether this falls on a blackout period." error remains). This preserves UX: the UI shows a blackout warning based on the teacher's selection. The field is simply no longer trusted for security-critical status determination.

3. **Fail-closed on query error** — If the Supabase blackout query fails (network, RLS misconfiguration, etc.), the action returns `{ message: 'Unable to verify blackout dates. Please try again.' }` rather than falling through to the insert using the client-supplied value. This is the correct security posture.

4. **is_blackout column stores serverBlackout** — The `is_blackout` column in the requests table now reflects the server's determination, not the teacher's self-report. This makes the DB an accurate audit record.

## Commits

| Hash | Message |
|------|---------|
| `185de4f` | feat(06-03): server-side blackout overlap query overrides client is_blackout (SEC-01) |

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Verification

`npx tsc --noEmit` — **PASSED** (zero errors, zero warnings)

## Self-Check: PASSED

- [x] `app/(public)/actions.ts` contains `.lte('start_date', end_date)`
- [x] `app/(public)/actions.ts` contains `.gte('end_date', start_date)`
- [x] `app/(public)/actions.ts` contains `.limit(1)`
- [x] `app/(public)/actions.ts` contains `const serverBlackout = (blackoutRows?.length ?? 0) > 0`
- [x] `app/(public)/actions.ts` contains `const status: RequestStatus = serverBlackout ? 'auto_denied' : 'pending'`
- [x] `app/(public)/actions.ts` contains `is_blackout: serverBlackout,`
- [x] `app/(public)/actions.ts` contains `if (serverBlackout) {`
- [x] `app/(public)/actions.ts` contains `if (!serverBlackout) {`
- [x] `app/(public)/actions.ts` contains `if (blackoutError) {`
- [x] `app/(public)/actions.ts` does NOT contain `const status: RequestStatus = is_blackout ? 'auto_denied' : 'pending'`
- [x] `app/(public)/actions.ts` does NOT contain standalone `is_blackout,` in the insert object
- [x] All four scenarios (A, B, C, D) produce the correct status by logic trace
- [x] `npx tsc --noEmit` exits with code 0
- [x] Task committed with descriptive message `185de4f`
