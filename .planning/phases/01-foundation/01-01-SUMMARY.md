---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [nextjs, typescript, tailwind, supabase, iron-session, resend]

# Dependency graph
requires: []
provides:
  - Next.js 15.5.12 app scaffold with App Router and TypeScript
  - Full directory structure matching locked layout from CONTEXT.md
  - All production dependencies installed (supabase, iron-session, resend, server-only)
  - Placeholder routes for all 6 app pages
  - middleware.ts stub with /admin matcher ready for Phase 4
  - .env.example with all 8 env var names, SEC-02 compliant
affects: [01-02, 01-03, phase-2, phase-3, phase-4]

# Tech tracking
tech-stack:
  added:
    - next@15.5.12
    - "@supabase/supabase-js@^2.99.0"
    - iron-session@^8.0.4
    - resend@^6.9.3
    - server-only@^0.0.1
    - tailwindcss (via create-next-app)
    - typescript
  patterns:
    - Route groups (public)/ and (admin)/ for access-level separation
    - All secrets as server-only env vars with no NEXT_PUBLIC_ prefix
    - .gitkeep files for empty dirs to be populated in later plans

key-files:
  created:
    - app/(public)/page.tsx
    - app/(public)/confirmation/page.tsx
    - app/(admin)/admin/page.tsx
    - app/(admin)/admin/login/page.tsx
    - app/api/approve/route.ts
    - middleware.ts
    - .env.example
  modified:
    - package.json
    - app/layout.tsx
    - app/globals.css
    - .gitignore

key-decisions:
  - "Scaffolded via create-next-app@15 in temp dir — project dir name has spaces which block the CLI"
  - "Google Fonts (Geist) removed from layout.tsx per CONTEXT.md styling baseline (default system font)"
  - "globals.css trimmed to @import tailwindcss only — Tailwind v4 syntax, no legacy directives"
  - "Updated .gitignore from .env* wildcard to .env.local/.env*.local to allow .env.example to be committed"

patterns-established:
  - "Route group pattern: (public)/ for teacher-facing routes, (admin)/ for admin routes"
  - "Env var convention: all secrets are plain names with no NEXT_PUBLIC_ prefix (SEC-02)"
  - "server-only package installed for enforcing server boundaries in lib modules (Plans 02-03)"

requirements-completed: [SEC-02]

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**Next.js 15.5.12 app bootstrapped with App Router route groups, all production dependencies, placeholder routes, middleware stub, and SEC-02-compliant env var documentation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T03:53:45Z
- **Completed:** 2026-03-11T03:58:25Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Next.js 15.5.12 app fully scaffolded with TypeScript and Tailwind v4
- All production dependencies installed: @supabase/supabase-js, iron-session, resend, server-only
- Complete placeholder route structure created: 4 page routes + 1 API route + middleware stub
- .env.example committed with all 8 required secret names, SEC-02 enforced (no NEXT_PUBLIC_ on any secret)
- npm run build passes with zero errors — 6 routes + middleware compiled successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 app and install dependencies** - `d43efc9` (chore)
2. **Task 2: Create directory structure and placeholder route files** - `2c87b2e` (feat)
3. **Task 3: Create .env.example and .env.local with SEC-02-compliant variable names** - `82a62e1` (chore)

## Files Created/Modified

- `package.json` - Next.js 15.5.12 + all production deps (@supabase/supabase-js, iron-session, resend, server-only)
- `app/layout.tsx` - Root layout with project metadata, system font stack (Geist removed)
- `app/globals.css` - Tailwind v4 import only
- `app/(public)/page.tsx` - Teacher form route placeholder
- `app/(public)/confirmation/page.tsx` - Confirmation page placeholder
- `app/(admin)/admin/page.tsx` - Admin dashboard placeholder
- `app/(admin)/admin/login/page.tsx` - Admin login placeholder
- `app/api/approve/route.ts` - Approval handler placeholder (GET returns JSON)
- `middleware.ts` - Next.js middleware stub with /admin/:path* matcher
- `.env.example` - All 8 env var names documented, no NEXT_PUBLIC_ on any secret (SEC-02)
- `.gitignore` - Updated to allow .env.example while blocking .env.local

## Decisions Made

- Scaffolded in a temp directory (`time-off-request-temp`) because the project directory name contains spaces, which the create-next-app CLI rejects. Files were copied to the actual project directory.
- Removed Google Fonts (Geist) from layout.tsx per CONTEXT.md styling baseline that specifies default Tailwind system font stack.
- Updated .gitignore from `.env*` wildcard to `.env.local` and `.env*.local` so `.env.example` can be committed.
- Tailwind v4 syntax (`@import "tailwindcss"`) preserved — this is the correct directive for Next.js 15 + Tailwind v4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffolded in temp directory due to spaces in project name**
- **Found during:** Task 1 (Scaffold Next.js 15 app)
- **Issue:** create-next-app rejects project names with spaces — "name can only contain URL-friendly characters". The project root is "time off request system".
- **Fix:** Created temp directory `time-off-request-temp`, ran create-next-app there, then copied all files to the actual project directory. Cleaned up temp directory afterward.
- **Files modified:** All scaffold files (package.json, app/, etc.)
- **Verification:** All files present, npm run build passes, Next.js v15.5.12 confirmed
- **Committed in:** d43efc9 (Task 1 commit)

**2. [Rule 1 - Bug] Updated .gitignore to allow .env.example**
- **Found during:** Task 3 (Create .env.example)
- **Issue:** create-next-app generates `.gitignore` with `.env*` which would block `.env.example` from being committed — violating the plan requirement.
- **Fix:** Changed `.env*` wildcard to `.env.local` and `.env*.local` to only block actual secret files.
- **Files modified:** .gitignore
- **Verification:** `git check-ignore .env.local` shows ignored; `git check-ignore .env.example` returns no match (not ignored)
- **Committed in:** d43efc9 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes required by project environment and plan requirements. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

Fill in `.env.local` with actual values before running Phase 2 or later:

```
SUPABASE_URL=          # From Supabase Dashboard → Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=  # From same page — WARNING: bypasses RLS
RESEND_API_KEY=        # From resend.com → API Keys
ADMIN_EMAILS=          # Comma-separated admin notification addresses
RESEND_FROM=           # Verified Resend domain sender address
APPROVAL_SECRET=       # openssl rand -base64 32
ADMIN_PASSWORD=        # Admin dashboard password
SESSION_SECRET=        # openssl rand -base64 32 (min 32 chars)
```

## Next Phase Readiness

- Foundation is complete. Plan 01-02 (Supabase migration + TypeScript types) can begin immediately.
- Plan 01-03 (lib module stubs) depends on 01-02 for typed client.
- .env.local values for SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY needed before Plan 01-02 SQL migration can be applied.

---
*Phase: 01-foundation*
*Completed: 2026-03-11*

## Self-Check: PASSED

All claimed files verified present on disk. All 3 task commits verified in git log (d43efc9, 2c87b2e, 82a62e1). npm run build passes with zero errors.
