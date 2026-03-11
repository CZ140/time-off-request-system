---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [supabase, resend, iron-session, server-only, next.js-15, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 15 scaffold with TypeScript, all production deps installed
  - phase: 01-02
    provides: types/database.ts with Database, LeaveType, RequestStatus types
provides:
  - lib/supabase/server.ts — sole Supabase entry point for the entire app, typed with Database
  - lib/email/send.ts — Resend email wrapper accepting single or multi-recipient sends
  - lib/auth/session.ts — iron-session admin session with getSession/createSession/destroySession
  - server-only sentinel on all three lib files — build-time enforcement of SEC-01
affects: [phase-2, phase-3, phase-4, 01-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - server-only import as first line in all server-side lib modules — build fails if imported in Client Component
    - Service role Supabase client with persistSession=false — required security config for service role
    - await cookies() before getIronSession() — Next.js 15 async cookies() requirement
    - Module-level Resend singleton per cold start — standard Next.js server-side pattern

key-files:
  created:
    - lib/supabase/server.ts
    - lib/email/send.ts
    - lib/auth/session.ts
  modified: []

key-decisions:
  - "All three lib files start with import 'server-only' — enforces SEC-01 at build time, not just by convention"
  - "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, SESSION_SECRET all have no NEXT_PUBLIC_ prefix — enforces SEC-02"
  - "Supabase client uses @supabase/supabase-js directly (not @supabase/ssr) — service role uses base package, SSR package is for user-auth flows"
  - "await cookies() is mandatory in getSession() — Next.js 15 made cookies() async; omitting await causes silent session malfunction"
  - "session.destroy() in destroySession() is synchronous — browser cookie cleared on next response, no await needed"

patterns-established:
  - "server-only pattern: all server-side lib modules must import 'server-only' as the first import"
  - "Single entry point pattern: all DB access goes through lib/supabase/server.ts createClient() — never inline"
  - "Next.js 15 cookies pattern: const cookieStore = await cookies() before passing to getIronSession()"

requirements-completed: [SEC-01, SEC-02]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 1 Plan 03: Server-Only Lib Module Stubs Summary

**Three server-only lib modules (Supabase client factory, Resend email wrapper, iron-session admin auth) with build-time SEC-01 enforcement via `import 'server-only'` sentinel on all three files**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T04:04:35Z
- **Completed:** 2026-03-11T04:09:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created lib/supabase/server.ts as sole DB entry point, typed with Database from types/database.ts, service role client with persistSession=false
- Created lib/email/send.ts wrapping Resend, supporting string | string[] recipients for Phase 3 multi-admin sends
- Created lib/auth/session.ts using iron-session v8 with await cookies() for Next.js 15 async cookies() API
- npm run build passes with zero errors — server-only sentinel mechanically enforces SEC-01
- SEC-02 audit confirms no NEXT_PUBLIC_ prefix on any server-secret environment variables

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/supabase/server.ts** - `0660544` (feat)
2. **Task 2: Create lib/email/send.ts** - `26f57e2` (feat)
3. **Task 3: Create lib/auth/session.ts** - `b7dbfce` (feat)

## Files Created/Modified

- `lib/supabase/server.ts` - Sole Supabase client factory, typed with Database, service role config, server-only sentinel
- `lib/email/send.ts` - Resend wrapper with sendEmail({ to, subject, html }), to accepts string | string[]
- `lib/auth/session.ts` - iron-session admin session, exports getSession/createSession/destroySession/AdminSessionData

## Decisions Made

- Used `import 'server-only'` as first import in all three files rather than relying on convention. This makes it a build error (not just a lint warning) to accidentally import any of these from a Client Component.
- Supabase client uses `@supabase/supabase-js` directly, not `@supabase/ssr`. The SSR package is for user-auth flows with cookie-based sessions; the service role pattern requires the base package.
- `await cookies()` is not optional in `getSession()`. Next.js 15 changed `cookies()` to return a Promise. Passing the un-awaited Promise to `getIronSession()` causes silent malfunction where session data appears undefined.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required by this plan. The three lib stubs are complete and ready for Phase 2 and Phase 4 callers. Environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM, SESSION_SECRET) were already specified in .env.example from Plan 01-01.

## Next Phase Readiness

- All three lib module entry points are complete and typed — Phase 2 can import createClient() from lib/supabase/server.ts and sendEmail() from lib/email/send.ts immediately
- Phase 4 admin auth can import getSession/createSession/destroySession from lib/auth/session.ts
- server-only enforcement is active — any accidental Client Component import will fail at build time
- No blockers for Phase 2 development

---
*Phase: 01-foundation*
*Completed: 2026-03-11*

## Self-Check: PASSED

- `lib/supabase/server.ts` — FOUND
- `lib/email/send.ts` — FOUND
- `lib/auth/session.ts` — FOUND
- Task 1 commit 0660544 — FOUND
- Task 2 commit 26f57e2 — FOUND
- Task 3 commit b7dbfce — FOUND
- npm run build — PASSED (zero errors)
- SEC-02 audit — PASSED (no NEXT_PUBLIC_ violations)
