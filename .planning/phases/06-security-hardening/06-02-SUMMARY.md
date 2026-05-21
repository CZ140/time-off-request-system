---
phase: 6
plan: "06-02"
title: "HMAC-SHA256 approval tokens"
requirements_addressed: [SEC-02]
completed: "2026-05-21"
tsc_passed: true
---

# Phase 6 Plan 02: HMAC-SHA256 Approval Tokens Summary

**One-liner:** Per-request HMAC-SHA256 tokens scoped to id:action replace the shared APPROVAL_SECRET, eliminating cross-request and cross-action token reuse with timing-safe verification.

## What Was Built

### Files Created

| File | Description |
|------|-------------|
| `lib/auth/tokens.ts` | New module — `generateApprovalToken()` produces a 64-char hex HMAC-SHA256 token; `verifyApprovalToken()` performs timing-safe comparison with length guard before `timingSafeEqual` |

### Files Modified

| File | Change |
|------|--------|
| `app/(public)/actions.ts` | Added `import { generateApprovalToken } from '@/lib/auth/tokens'`; generate `approveToken` and `denyToken` constants before the batch map; replaced `encodeURIComponent(process.env.APPROVAL_SECRET ?? '')` in both URLs with the per-request hex tokens |
| `app/api/approve/route.ts` | Added `import { verifyApprovalToken } from '@/lib/auth/tokens'`; replaced `token !== process.env.APPROVAL_SECRET` string equality with a three-step guard: presence check → action type check → `verifyApprovalToken()` HMAC check |
| `.env.example` | Replaced APPROVAL_SECRET-only block with documented APPROVAL_HMAC_SECRET (generation command included) plus annotated APPROVAL_SECRET as legacy/deprecated |

## Key Decisions Made

1. **Explicit three-step validation ordering in route.ts** — Presence check (`!token || !id || !action`) is first, action type check is second, HMAC check is third. This matches the plan's prescribed ordering and keeps each guard at a distinct if-block for readability. The old combined guard (`token !== process.env.APPROVAL_SECRET` inline) is gone.

2. **Non-assertion `!` on APPROVAL_HMAC_SECRET** — The plan specifies `process.env.APPROVAL_HMAC_SECRET!` (non-null assertion). This is acceptable because lib/config.ts (added in 06-01) already validates APPROVAL_HMAC_SECRET at startup and throws if it is missing, so the `!` cannot produce a runtime null.

3. **APPROVAL_SECRET retained in .env.example as deprecated** — Kept with a migration note so operators upgrading from a previous deployment know what the old variable was and that it can be removed once APPROVAL_HMAC_SECRET is confirmed set.

4. **Hex encoding (no encodeURIComponent on token)** — HMAC-SHA256 hex output is `[0-9a-f]`, URL-safe by construction. The old `encodeURIComponent(APPROVAL_SECRET)` call is removed; `admin` query param still uses `encodeURIComponent` since email addresses may contain `@` and `+`.

## Deployment Requirement

**APPROVAL_HMAC_SECRET must be added to both `.env.local` and the Vercel dashboard before deploying.**

Generate a secure value:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The app will refuse to start without this variable (enforced by `lib/config.ts` from plan 06-01).

## Commits

| Hash | Message |
|------|---------|
| `047b398` | feat(06-02): create lib/auth/tokens.ts with HMAC generate and verify functions (SEC-02) |
| `1e0aded` | feat(06-02): wire HMAC tokens into actions.ts, route.ts, and .env.example (SEC-02) |

## Deviations from Plan

None — plan executed exactly as written.

## Logic Verification

Verified with live Node.js execution that:
- `approve === deny` → `false` (different tokens for same id, different actions)
- `approve.length` → `64` (correct hex length for SHA-256)

## TypeScript Verification

`npx tsc --noEmit` — **PASSED** (zero errors, zero warnings)

## Self-Check: PASSED

- [x] `lib/auth/tokens.ts` exists and exports `generateApprovalToken` and `verifyApprovalToken`
- [x] `lib/auth/tokens.ts` imports `createHmac, timingSafeEqual` from `node:crypto`
- [x] `lib/auth/tokens.ts` contains length guard before `timingSafeEqual`
- [x] `lib/auth/tokens.ts` has no default export
- [x] `app/(public)/actions.ts` imports `generateApprovalToken` from `@/lib/auth/tokens`
- [x] `app/(public)/actions.ts` has `const approveToken =` and `const denyToken =`
- [x] `app/(public)/actions.ts` does NOT contain `encodeURIComponent(process.env.APPROVAL_SECRET`
- [x] `app/api/approve/route.ts` imports `verifyApprovalToken` from `@/lib/auth/tokens`
- [x] `app/api/approve/route.ts` calls `verifyApprovalToken(process.env.APPROVAL_HMAC_SECRET!`
- [x] `app/api/approve/route.ts` does NOT contain `token !== process.env.APPROVAL_SECRET`
- [x] `.env.example` contains `APPROVAL_HMAC_SECRET=`
- [x] `npx tsc --noEmit` exits with code 0
- [x] Both tasks committed individually with descriptive messages
