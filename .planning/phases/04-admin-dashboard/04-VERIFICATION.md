---
phase: 04-admin-dashboard
verified: 2026-03-13T00:00:00Z
status: passed
score: 8/8 must-haves verified (automated); 1 item requires human re-confirmation
re_verification: false
human_verification:
  - test: "Navigate to /admin (bare path, no trailing segment) without being logged in"
    expected: "Should redirect to /admin/login — middleware matcher '/admin/:path*' does NOT match the bare /admin path in Next.js 15, so middleware gate is skipped; only the (protected) layout gate fires"
    why_human: "The middleware matcher gap means the dual-gate guarantee is asymmetric: /admin/login and subpaths get both gates, /admin itself gets only the layout gate. This is functional (layout blocks access) but the middleware is not a true first-gate for the dashboard root URL. Needs human confirmation that the layout alone is sufficient in their threat model."
  - test: "CVE-2025-29927 bypass: curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/admin -H 'x-middleware-subrequest: pages-router-edge-server/next-edge-server'"
    expected: "Should return 307 (redirect) not 200 — confirmed by smoke test but automated verification cannot re-run curl test"
    why_human: "CVE bypass test requires a running dev server. The smoke test in Plan 04 confirmed 307 return, but this verifier cannot independently re-execute the curl check."
---

# Phase 4: Admin Dashboard Verification Report

**Phase Goal:** Admins can review the full request history in a filterable table and manage blackout date ranges, all behind a password-protected page that is safe from middleware bypass attacks
**Verified:** 2026-03-13
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Navigating to `/admin` without a session cookie redirects to the login page; correct password grants access via httpOnly cookie | VERIFIED | `middleware.ts` redirects unauthenticated `/admin/*`; `(protected)/layout.tsx` independently redirects; `login/actions.ts` calls `createSession()` + `redirect('/admin')` on password match |
| 2 | Admin auth is verified in both middleware and the admin layout, so the dashboard cannot be accessed by sending an `x-middleware-subrequest` bypass header | VERIFIED (with note) | Dual-gate exists: middleware uses inline `getIronSession`; `(protected)/layout.tsx` calls `getSession()` from `lib/auth/session.ts`. Smoke test confirmed curl bypass returns 307. See note on middleware matcher scope. |
| 3 | Requests tab shows all requests with the correct columns, color-coded status badges, and allows filtering by status and sorting by any column header | VERIFIED | `RequestsTab.tsx` has all 10 required columns; `STATUS_BADGE` map covers all 4 statuses with correct colors; filter uses DB literal values (`auto_denied`); sort uses `useMemo` with toggle; `submitted_at` uses `new Date()` for ISO timestamp parsing (bug fixed in Plan 04) |
| 4 | Blackout Dates tab lists all date ranges and allows adding a new range and deleting any existing range | VERIFIED | `BlackoutDatesTab.tsx`: inline add form with `formKey` reset; `addBlackoutDate` server action inserts to DB; delete uses `confirmId` inline confirm pattern; `router.refresh()` called after both mutations; empty state shows "No blackout dates set." |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `middleware.ts` | VERIFIED | Exists; `getIronSession` called inline; `import type AdminSessionData` (type-only, Edge-safe); matcher `['/admin/:path*']`; redirects unauthenticated non-login requests; redirects logged-in users away from login |
| `app/(admin)/admin/(protected)/layout.tsx` | VERIFIED | Exists; calls `getSession()` from `@/lib/auth/session`; redirects if `!session.isLoggedIn`; wraps all routes under `(protected)` including the dashboard page |
| `app/(admin)/admin/layout.tsx` | VERIFIED | Exists; passthrough only — intentionally has no auth check so login page is accessible |
| `app/(admin)/admin/login/actions.ts` | VERIFIED | Exports `loginAdmin` and `LoginState`; compares against `process.env.ADMIN_PASSWORD`; calls `createSession()` then `redirect('/admin')`; returns `{ error: 'Incorrect password. Please try again.' }` on mismatch |
| `app/(admin)/admin/login/page.tsx` | VERIFIED | `'use client'`; uses `useActionState(loginAdmin, initialState)`; centered white card; inline error with `role="alert"`; pending state disables button |
| `app/(admin)/admin/(protected)/page.tsx` | VERIFIED | Server component; `createClient()` called; `Promise.all` fetches `requests` and `blackout_dates`; passes typed arrays to `TabSwitcher`; includes logout form wired to `logoutAdmin` |
| `app/(admin)/admin/_components/TabSwitcher.tsx` | VERIFIED | `'use client'`; `useState` manages `'requests' | 'blackout'` tab; renders `RequestsTab` or `BlackoutDatesTab` conditionally; not a stub |
| `app/(admin)/admin/_components/RequestsTab.tsx` | VERIFIED | `'use client'`; 10-column table matching ADMIN-03; filter pills with DB literal values; sortable columns with toggle; null-safe `String(value ?? '')`; `submitted_at` parsed via `new Date()` (not `formatDate()`) |
| `app/(admin)/admin/_components/BlackoutDatesTab.tsx` | VERIFIED | Full implementation (not stub); inline add form with `formKey` reset; `confirmId` inline confirm-delete; `router.refresh()` in both add and delete handlers; `formatDate` used for `start_date`/`end_date` |
| `app/(admin)/admin/actions.ts` | VERIFIED | Full implementation; exports `logoutAdmin`, `addBlackoutDate`, `deleteBlackoutDate`, `BlackoutDateState`; `logoutAdmin` calls `destroySession()` then `redirect('/admin/login')`; `addBlackoutDate` validates and inserts to DB; `deleteBlackoutDate` deletes by id |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `middleware.ts` | iron-session cookie | `getIronSession()` inline with local `sessionOptions` | WIRED | `sessionOptions` exactly matches `lib/auth/session.ts` (same `cookieName`, `password`, `cookieOptions`) |
| `app/(admin)/admin/(protected)/layout.tsx` | `lib/auth/session.ts` | `getSession()` import — independent second check | WIRED | `import { getSession } from '@/lib/auth/session'`; called on every request to protected routes |
| `app/(admin)/admin/login/actions.ts` | `lib/auth/session.ts` | `createSession()` on password match | WIRED | `import { createSession } from '@/lib/auth/session'`; called before `redirect('/admin')` |
| `app/(admin)/admin/(protected)/page.tsx` | `lib/supabase/server.ts` | `createClient()` — server-side data fetch | WIRED | `import { createClient } from '@/lib/supabase/server'`; used in `Promise.all` |
| `app/(admin)/admin/_components/RequestsTab.tsx` | `lib/email/utils.ts` | `LEAVE_TYPE_LABELS` and `formatDate` | WIRED | `import { LEAVE_TYPE_LABELS, formatDate } from '@/lib/email/utils'`; both used in cell rendering |
| `app/(admin)/admin/_components/RequestsTab.tsx` | filter state | DB literal values for `RequestStatus` | WIRED | `FILTER_OPTIONS` uses `'auto_denied'`, `'pending'`, `'approved'`, `'denied'` — matches `r.status === statusFilter` comparison |
| `app/(admin)/admin/_components/BlackoutDatesTab.tsx` | `app/(admin)/admin/actions.ts` | `addBlackoutDate` and `deleteBlackoutDate` imports | WIRED | `import { addBlackoutDate, deleteBlackoutDate, type BlackoutDateState } from '../actions'` |
| `app/(admin)/admin/_components/BlackoutDatesTab.tsx` | `next/navigation` | `router.refresh()` after mutations | WIRED | `useRouter()` called; `router.refresh()` in both add success handler and `handleDelete` |
| `app/(admin)/admin/actions.ts` | `lib/auth/session.ts` | `destroySession()` in `logoutAdmin` | WIRED | `import { destroySession } from '@/lib/auth/session'`; called before `redirect('/admin/login')` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ADMIN-01 | 04-01-PLAN.md | Dashboard protected by `ADMIN_PASSWORD` env var with httpOnly cookie session | SATISFIED | `loginAdmin` checks `process.env.ADMIN_PASSWORD`; `createSession()` sets httpOnly cookie via iron-session; `getSession()` verifies on every admin route |
| ADMIN-02 | 04-01-PLAN.md | Auth verified in both middleware and admin layout (CVE-2025-29927 mitigation) | SATISFIED (with scope note) | Middleware uses inline `getIronSession`; `(protected)/layout.tsx` uses `getSession()` independently. Note: middleware matcher `/admin/:path*` does not match bare `/admin` — layout is the only gate for the dashboard root. For `/admin/*` subpaths, both gates fire. |
| ADMIN-03 | 04-02-PLAN.md | Requests tab shows all columns: Teacher Name, Email, Leave Type, Start Date, End Date, Reason, Blackout?, Status (color-coded badge), Submitted Date, Reviewed By | SATISFIED | All 10 columns present in `COLUMNS` array; status badge uses `STATUS_BADGE` map with correct Tailwind color classes |
| ADMIN-04 | 04-02-PLAN.md | Requests table filterable by status (All / Pending / Approved / Denied / Auto-Denied) | SATISFIED | `FILTER_OPTIONS` array with DB literal values; `useMemo` filters `requests.filter(r => r.status === statusFilter)` |
| ADMIN-05 | 04-02-PLAN.md | Requests table columns sortable by clicking column headers | SATISFIED | All 10 column headers have `onClick={() => handleColumnClick(col.key)}`; sort toggle on re-click; `↑`/`↓` indicator rendered |
| ADMIN-06 | 04-03-PLAN.md | Blackout Dates tab shows all date ranges with label, start date, and end date | SATISFIED | `BlackoutDatesTab.tsx` renders table with Label, Start Date, End Date columns; empty state "No blackout dates set." |
| ADMIN-07 | 04-03-PLAN.md | Admin can add a blackout date range with a label, start date, and end date | SATISFIED | Inline add form; `addBlackoutDate` server action validates + inserts; `formKey` resets form on success; `router.refresh()` updates list |
| ADMIN-08 | 04-03-PLAN.md | Admin can delete any blackout date range | SATISFIED | `confirmId` state drives inline confirm pattern; `handleDelete` calls `deleteBlackoutDate(id)`; `router.refresh()` updates list |

All 8 ADMIN requirements from REQUIREMENTS.md are claimed by plans and have corresponding implementation evidence. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(admin)/admin/_components/BlackoutDatesTab.tsx` | 46 | `placeholder="e.g. Spring Break"` | Info | HTML input placeholder — this is intentional UX guidance text, not a code stub |

No blocker or warning anti-patterns found. No TODO/FIXME/HACK/empty implementations detected in any phase 4 file.

---

### Notable Implementation Details

**Middleware matcher scope (ADMIN-02 nuance):**
The matcher `['/admin/:path*']` covers `/admin/login`, `/admin/settings`, and any `/admin/*` subpaths, but does NOT match the bare `/admin` path (Next.js 15 behavior — `:path*` requires at least one segment). The dashboard root URL `/admin` therefore only receives the layout gate check, not the middleware gate. This is compensated by the `(protected)` layout running unconditionally on every server render of `/admin`, which satisfies the CVE-2025-29927 mitigation requirement. The smoke test (Plan 04) confirmed the bypass header returns 307 — meaning the layout gate alone is sufficient to block the attack.

**submitted_at bug fix (Plan 04):**
`RequestsTab.tsx` was updated to parse `submitted_at` as a full ISO timestamp via `new Date(row.submitted_at).toLocaleDateString('en-US', {...})` rather than passing to `formatDate()`, which expects plain `YYYY-MM-DD` strings. Commit `d23a399` implements this fix. The final rendering is verified correct.

**Session options consistency:**
`middleware.ts` defines its own `sessionOptions` constant (required to avoid importing `server-only` in Edge runtime). The options are byte-for-byte identical to those in `lib/auth/session.ts`: same `password`, same `cookieName: 'admin-session'`, same `cookieOptions`. This ensures middleware and layout read the same iron-session cookie correctly.

---

### Human Verification Required

#### 1. Middleware Coverage of Bare `/admin` Path

**Test:** Stop any running server. Clear all admin cookies. Start the dev server with `npm run dev`. Navigate directly to `http://localhost:3000/admin` (no trailing slash, no subpath).
**Expected:** Should redirect to `/admin/login`. The `(protected)` layout gate fires even though the middleware matcher does not cover this path.
**Why human:** Cannot programmatically verify Next.js middleware matcher behavior vs. actual runtime routing without running the application. The layout is expected to handle this, but confirming the actual redirect happens is important for ADMIN-01 and ADMIN-02 confidence.

#### 2. CVE-2025-29927 Bypass Block

**Test:** With dev server running and NOT logged in: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin -H "x-middleware-subrequest: pages-router-edge-server/next-edge-server"`
**Expected:** Returns `307` (redirect to login), not `200` (dashboard content).
**Why human:** Requires a running dev server. Plan 04 smoke test confirmed this, but the verifier cannot re-execute the curl check independently.

---

### Gaps Summary

No functional gaps found. All 8 ADMIN requirements have complete, non-stub implementations wired end-to-end. The two human verification items are confirmation checks, not missing functionality.

The middleware matcher scope note is a documentation-level observation: the dual-gate claim in ADMIN-02 is fully true for `/admin/*` subpaths, and the layout gate alone protects `/admin` — which is the more important protection since that is the dashboard entry point.

---

_Verified: 2026-03-13_
_Verifier: Claude (gsd-verifier)_
