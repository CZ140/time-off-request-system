---
phase: 03-email-approval-workflow
plan: "04"
subsystem: approval-redirect-pages
tags: [next.js, server-component, tailwind, approval-workflow]
dependency_graph:
  requires: [03-01]
  provides: [reviewed-page, invalid-page]
  affects: [app/api/approve/route.ts]
tech_stack:
  added: []
  patterns: [next15-async-searchparams, static-server-component, graceful-fallback]
key_files:
  created:
    - app/reviewed/page.tsx
    - app/invalid/page.tsx
  modified: []
decisions:
  - "formatDate and LEAVE_TYPE_LABELS defined inline in reviewed/page.tsx per plan spec (no shared import for page component)"
  - "Graceful fallback to dash for all missing params ensures page never crashes"
  - "/invalid is fully static — no props/searchParams needed"
metrics:
  duration: "4 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  files_created: 2
---

# Phase 3 Plan 4: Approval Redirect Pages Summary

**One-liner:** Static `/invalid` error page and dynamic `/reviewed` status page for approval route handler redirects, both following Next.js 15 async searchParams pattern.

## What Was Built

Two new Next.js pages that serve as landing destinations for the `/api/approve` route handler:

- **`app/reviewed/page.tsx`** — Async server component that reads six URL query params (`status`, `teacher_name`, `start_date`, `end_date`, `leave_type`, `reviewed_by`). Displays a green or red status badge, a details table with formatted dates and leave type labels, and gracefully falls back to "—" for any missing param. Suitable for both the first-click success redirect and the idempotency second-click redirect.

- **`app/invalid/page.tsx`** — Fully static server component (no props). Displays an amber warning icon with a clear explanation that the link is invalid, expired, or has already been used. No request details are shown because none are available when token validation fails.

## Verification

- `npm run lint` — passes (1 pre-existing warning in middleware.ts, unrelated)
- `npm run build` — both pages appear in build output: `/invalid` as static, `/reviewed` as dynamic (server-rendered on demand)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- FOUND: app/reviewed/page.tsx
- FOUND: app/invalid/page.tsx

Commits exist:
- 18935c0: feat(03-04): create /reviewed already-reviewed page
- 83024c3: feat(03-04): create /invalid error page
