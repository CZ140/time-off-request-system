---
phase: 06-security-hardening
verified: 2026-05-21T00:00:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 6: Security Hardening Verification Report

**Phase Goal:** The application enforces correctness server-side and cannot be manipulated via client-controlled inputs or leaked tokens.
**Verified:** 2026-05-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | SEC-01: blackout_dates queried with .lte/.gte overlap before any insert | VERIFIED | actions.ts lines 117-122: `.from('blackout_dates').select('id').lte('start_date', end_date).gte('end_date', start_date).limit(1)` |
| 2  | SEC-01: serverBlackout (not form is_blackout) determines status | VERIFIED | actions.ts line 130: `const serverBlackout = (blackoutRows?.length ?? 0) > 0`; line 133: `const status: RequestStatus = serverBlackout ? 'auto_denied' : 'pending'` |
| 3  | SEC-01: old client-trusted status line removed | VERIFIED | Searched full actions.ts — `const status: RequestStatus = is_blackout ? 'auto_denied' : 'pending'` does not exist |
| 4  | SEC-01: blackout query failure is fail-closed (returns error, no insert) | VERIFIED | actions.ts lines 124-128: `if (blackoutError) { return { message: 'Unable to verify blackout dates. Please try again.' } }` |
| 5  | SEC-02: lib/auth/tokens.ts exists with both named exports | VERIFIED | File exists at `lib/auth/tokens.ts`; exports `generateApprovalToken` (line 18) and `verifyApprovalToken` (line 36) |
| 6  | SEC-02: verifyApprovalToken guards buffer length before timingSafeEqual | VERIFIED | tokens.ts lines 51-53: `if (expectedBuf.length !== providedBuf.length) { return false }`; line 55: `return timingSafeEqual(expectedBuf, providedBuf)` |
| 7  | SEC-02: actions.ts generates per-request HMAC tokens (not raw APPROVAL_SECRET) | VERIFIED | actions.ts lines 187-188: `generateApprovalToken(process.env.APPROVAL_HMAC_SECRET!, inserted.id, 'approve')` and `...,'deny')`; old `encodeURIComponent(process.env.APPROVAL_SECRET` absent |
| 8  | SEC-02: route.ts uses verifyApprovalToken; string equality removed | VERIFIED | route.ts line 41: `verifyApprovalToken(process.env.APPROVAL_HMAC_SECRET!, id, action, token)`; `token !== process.env.APPROVAL_SECRET` absent |
| 9  | SEC-02: no duplicate action-type check in route.ts | VERIFIED | Single `if (action !== 'approve' && action !== 'deny')` block at line 38; old combined guard removed |
| 10 | SEC-03: EMAIL_REGEX constant present in actions.ts | VERIFIED | actions.ts line 14: `const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| 11 | SEC-03: format check runs after presence check via else if | VERIFIED | actions.ts lines 59-63: `if (!teacher_email?.trim()) {...} else if (!EMAIL_REGEX.test(teacher_email)) { errors.teacher_email = ['Please enter a valid email address.'] }` |
| 12 | SEC-04: all four security headers in next.config.ts headers() | VERIFIED | next.config.ts lines 3-11: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy; `async headers()` at line 14; source `'/(.*)'` at line 18 |
| 13 | SEC-05: lib/config.ts validates APPROVAL_HMAC_SECRET and SESSION_SECRET length; server-only enforced | VERIFIED | lib/config.ts: `import 'server-only'` (line 5); REQUIRED_VARS includes `'APPROVAL_HMAC_SECRET'` (line 13); `throw new Error(\`Missing required env var: ${key}\`)` (line 22); SESSION_SECRET length check (lines 26-29); `'APPROVAL_SECRET'` absent from REQUIRED_VARS |
| 14 | SEC-05: lib/config.ts imported in server entry points; middleware.ts untouched | VERIFIED | `lib/supabase/server.ts` line 7: `import '@/lib/config'`; `lib/auth/session.ts` line 10: `import '@/lib/config'`; middleware.ts contains no reference to `lib/config` |

**Score:** 14/14 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/config.ts` | New module — startup env var validation | VERIFIED | 31 lines; REQUIRED_VARS loop, SESSION_SECRET length check, server-only import |
| `lib/auth/tokens.ts` | New module — HMAC generate/verify | VERIFIED | 56 lines; two named exports, node:crypto, timingSafeEqual with length guard |
| `lib/supabase/server.ts` | Modified — import '@/lib/config' added | VERIFIED | Line 7: `import '@/lib/config'` immediately after `import 'server-only'` |
| `lib/auth/session.ts` | Modified — import '@/lib/config' added | VERIFIED | Line 10: `import '@/lib/config'` immediately after `import 'server-only'` |
| `next.config.ts` | Modified — headers() with 4 security headers | VERIFIED | All four headers present; async headers() function; source `'/(.*)'` |
| `app/(public)/actions.ts` | Modified — EMAIL_REGEX, HMAC tokens, server blackout query | VERIFIED | EMAIL_REGEX, else-if format check, generateApprovalToken usage, serverBlackout query, serverBlackout-derived status, is_blackout: serverBlackout in insert |
| `app/api/approve/route.ts` | Modified — verifyApprovalToken replaces string equality | VERIFIED | verifyApprovalToken import and call; old `token !== process.env.APPROVAL_SECRET` absent |
| `.env.example` | Modified — APPROVAL_HMAC_SECRET documented | VERIFIED | Lines 44-53: APPROVAL_HMAC_SECRET with generation instructions; APPROVAL_SECRET retained as deprecated/legacy |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/supabase/server.ts` | `lib/config.ts` | `import '@/lib/config'` side-effect | WIRED | Line 7 of server.ts; triggers REQUIRED_VARS loop on module load |
| `lib/auth/session.ts` | `lib/config.ts` | `import '@/lib/config'` side-effect | WIRED | Line 10 of session.ts; triggers REQUIRED_VARS loop on module load |
| `app/(public)/actions.ts` | `lib/auth/tokens.ts` | `import { generateApprovalToken }` | WIRED | Line 10 of actions.ts; used at lines 187-188 |
| `app/api/approve/route.ts` | `lib/auth/tokens.ts` | `import { verifyApprovalToken }` | WIRED | Line 11 of route.ts; used at line 41 |
| `app/(public)/actions.ts` | `blackout_dates` (Supabase) | `.from('blackout_dates').lte.gte.limit(1)` | WIRED | Lines 117-122; result used at line 130 to compute serverBlackout |
| `serverBlackout` | `status` derivation | `serverBlackout ? 'auto_denied' : 'pending'` | WIRED | Line 133; status flows into insert (line 163) and email conditions (lines 170, 183) |
| `middleware.ts` | `lib/config.ts` | (intentionally NOT linked) | VERIFIED ABSENT | Edge Runtime constraint; middleware reads SESSION_SECRET directly via process.env |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `actions.ts` blackout check | `blackoutRows` | Supabase query on `blackout_dates` table with .lte/.gte/.limit(1) | Yes — live DB query | FLOWING |
| `actions.ts` approval URLs | `approveToken`, `denyToken` | `generateApprovalToken(APPROVAL_HMAC_SECRET!, inserted.id, action)` | Yes — HMAC-SHA256 of real DB-inserted id | FLOWING |
| `route.ts` token verification | `verifyApprovalToken` result | Recomputes HMAC and runs timingSafeEqual | Yes — real crypto comparison | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: Skipped for server action and route handler logic — requires live Supabase connection and Resend credentials. Logic correctness verified via static code trace (all four SEC-01 scenarios, SEC-02 cross-action scoping).

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | 06-03 | Server-side blackout date enforcement overrides client is_blackout | SATISFIED | actions.ts: .lte/.gte query, serverBlackout derivation, fail-closed error handling |
| SEC-02 | 06-02 | HMAC-SHA256 per-request approval tokens replace shared APPROVAL_SECRET | SATISFIED | tokens.ts: generateApprovalToken/verifyApprovalToken; actions.ts and route.ts wired |
| SEC-03 | 06-01 | Server-side email format validation with EMAIL_REGEX | SATISFIED | actions.ts: EMAIL_REGEX constant and else-if format check |
| SEC-04 | 06-01 | HTTP security headers via next.config.ts headers() | SATISFIED | next.config.ts: all four headers, async headers(), source '(/.*) |
| SEC-05 | 06-01 | Startup env var validation in lib/config.ts, imported by server entry points | SATISFIED | lib/config.ts: REQUIRED_VARS loop, SESSION_SECRET length check; wired into supabase/server.ts and auth/session.ts; absent from middleware.ts |

---

## Anti-Patterns Found

No blockers or warnings found.

Reviewed files: `lib/config.ts`, `lib/auth/tokens.ts`, `lib/supabase/server.ts`, `lib/auth/session.ts`, `next.config.ts`, `app/(public)/actions.ts`, `app/api/approve/route.ts`

Notable observations (informational only):
- `app/(public)/actions.ts` line 184 still instantiates `new Resend(process.env.RESEND_API_KEY)` directly rather than going through `lib/email/send.ts`. This is a known deviation tracked as REL-05 (Phase 7) — intentionally deferred.
- `approvalConfirmationTemplate()` is called with no arguments at route.ts line 84. This is a known gap tracked as REL-03 (Phase 7) — intentionally deferred.

---

## Human Verification Required

None. All SEC-01 through SEC-05 must-haves are verifiable via static code analysis. No UI behavior, real-time behavior, or external service integration checks are required for this phase's goal.

---

## Gaps Summary

No gaps. All 14 observable truths are VERIFIED. Every artifact exists, is substantive, and is correctly wired. The phase goal — the application enforces correctness server-side and cannot be manipulated via client-controlled inputs or leaked tokens — is achieved across all five requirements (SEC-01 through SEC-05).

---

_Verified: 2026-05-21T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
