---
phase: 04-admin-dashboard
plan: "01"
subsystem: admin-auth
tags: [auth, middleware, iron-session, server-action, CVE-2025-29927]
dependency_graph:
  requires: []
  provides: [admin-auth-middleware, admin-protected-layout, admin-login-action, admin-login-page]
  affects: [all admin routes]
tech_stack:
  added: []
  patterns: [dual-auth-gate, type-only-import-for-edge-compatibility, nested-route-group-for-auth-boundary]
key_files:
  created:
    - app/(admin)/admin/layout.tsx
    - app/(admin)/admin/(protected)/layout.tsx
    - app/(admin)/admin/(protected)/page.tsx
    - app/(admin)/admin/login/actions.ts
  modified:
    - middleware.ts
    - app/(admin)/admin/login/page.tsx
decisions:
  - "admin/page.tsx moved into (protected) route group so the auth layout wraps dashboard but not the login page"
  - "type-only import (import type) used in middleware.ts to get AdminSessionData without triggering server-only in Edge runtime"
  - "redirect() placed outside try/catch in loginAdmin so NEXT_REDIRECT is never swallowed"
metrics:
  duration: "3 minutes"
  completed_date: "2026-03-13"
  tasks_completed: 3
  files_changed: 6
---

# Phase 4 Plan 01: Admin Auth Layer Summary

Dual-gate admin authentication using inline iron-session in middleware plus a server-component layout check, satisfying CVE-2025-29927 mitigation requirements.

## What Was Built

### middleware.ts — First auth gate (Edge runtime)
Replaced the pass-through stub with an async iron-session check. `getIronSession()` is called inline using locally-defined `sessionOptions` (identical to `lib/auth/session.ts`). A `type`-only import of `AdminSessionData` is used safely — stripped at compile time, no runtime execution. Unauthenticated requests to `/admin/*` redirect to `/admin/login`; logged-in users visiting `/admin/login` redirect to `/admin`.

### app/(admin)/admin/(protected)/layout.tsx — Second auth gate (Node.js server)
Independent auth check using `getSession()` from `lib/auth/session.ts`. Wraps all routes under `/admin/(protected)/*` via Next.js route group. Since middleware runs in the Edge runtime and can be bypassed (CVE-2025-29927), this layout ensures a compromised or bypassed middleware cannot expose the dashboard.

Route structure used to separate login from the protected layout:
- `app/(admin)/admin/layout.tsx` — passthrough, wraps all /admin/* routes
- `app/(admin)/admin/(protected)/layout.tsx` — auth check, wraps /admin (dashboard) only
- `app/(admin)/admin/login/` — outside (protected), accessible without session

### app/(admin)/admin/login/actions.ts — Login Server Action
`loginAdmin` server action compares form password against `ADMIN_PASSWORD` env var. Returns `{ error: 'Incorrect password. Please try again.' }` on mismatch. Calls `createSession()` then `redirect('/admin')` on match. `redirect()` is intentionally outside any try/catch to prevent NEXT_REDIRECT from being swallowed.

### app/(admin)/admin/login/page.tsx — Login UI
Client component using `useActionState(loginAdmin, initialState)`. Centered white card (800px wide max, consistent with teacher form) on gray-50 background. Password input, inline error display with `role="alert"`, pending state disables button and shows "Signing in...".

## Deviations from Plan

None — plan executed exactly as written. The route group structure (`(protected)`) described in the plan's task 2 was implemented as specified.

## Self-Check

- [x] middleware.ts — exists, contains `getIronSession`, has no runtime import from `lib/auth/session`
- [x] app/(admin)/admin/(protected)/layout.tsx — exists, calls `getSession()`
- [x] app/(admin)/admin/login/actions.ts — exports `loginAdmin` and `LoginState`
- [x] app/(admin)/admin/login/page.tsx — uses `useActionState(loginAdmin, ...)`
- [x] `npm run build` — exits 0, no TypeScript errors

## Self-Check: PASSED
