---
phase: 4
slug: admin-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — build + lint only (same as Phase 3) |
| **Config file** | None |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run lint && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run lint && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | ADMIN-01 | manual smoke | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 4-01-02 | 01 | 1 | ADMIN-02 | manual smoke | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 4-02-01 | 02 | 1 | ADMIN-03 | manual smoke | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 4-02-02 | 02 | 1 | ADMIN-04 | manual smoke | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 4-02-03 | 02 | 1 | ADMIN-05 | manual smoke | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 4-03-01 | 03 | 2 | ADMIN-06 | manual smoke | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 4-03-02 | 03 | 2 | ADMIN-07 | manual smoke | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 4-03-03 | 03 | 2 | ADMIN-08 | manual smoke | `npm run build` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/(admin)/admin/layout.tsx` — does not exist yet; needed before any wave 1 tasks
- [ ] `app/(admin)/admin/actions.ts` — server actions for blackout date mutations
- [ ] `app/(admin)/admin/login/actions.ts` — login/logout server actions
- [ ] `app/(admin)/admin/_components/` directory — UI component stubs
- [ ] `npm run build` baseline must pass before wave 1 begins

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auth redirect (unauthenticated) | ADMIN-01 | Browser session/cookie required | Navigate to `/admin` without cookie → should redirect to `/admin/login` |
| CVE-2025-29927 bypass blocked | ADMIN-02 | Requires sending custom HTTP header | `curl http://localhost:3000/admin -H 'x-middleware-subrequest: pages-router-edge-server/next-edge-server'` → should still redirect to login |
| Wrong password rejected | ADMIN-01 | Auth state required | Submit login form with wrong password → inline error shown, no redirect |
| Correct password grants access | ADMIN-01 | Auth state required | Submit with correct password → redirected to `/admin`, dashboard visible |
| Logout clears cookie | ADMIN-01 | httpOnly cookie, not inspectable via JS | Click Logout → redirected to `/admin/login`; subsequent `/admin` visit redirects again |
| Requests table columns correct | ADMIN-03 | UI visual verification | All columns present; status badges color-coded correctly |
| Status filter pills work | ADMIN-04 | UI interaction | Click "Pending" → only pending rows shown; "All" restores full list |
| Column sort toggles | ADMIN-05 | UI interaction | Click column header → rows re-sort; click again → direction toggles |
| Blackout Dates list renders | ADMIN-06 | UI visual verification | All existing ranges listed with label, start, end |
| Add blackout date | ADMIN-07 | DB write + UI refresh | Fill form, click Add → new range appears in list, form clears |
| Delete with inline confirm | ADMIN-08 | DB write + UI refresh | Click Delete → Confirm/Cancel appears; Confirm → row removed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
