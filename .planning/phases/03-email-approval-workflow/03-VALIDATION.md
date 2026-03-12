---
phase: 3
slug: email-approval-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — build + lint only |
| **Config file** | none — no test framework |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run lint && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run lint && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | REQ-03 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | EMAIL-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | APPR-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | APPR-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | APPR-03 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-02-04 | 02 | 2 | APPR-04 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | EMAIL-03 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | EMAIL-04 | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework installed — all behavioral verification is manual smoke testing or build-time type checking
- [ ] `npm run build` baseline must pass before wave 1 begins

*No new test files required — project has no test infrastructure. Wave 0 is a baseline build check.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin receives notification email with Approve/Deny buttons | REQ-03, EMAIL-02 | No email testing infrastructure | Submit a non-blackout form; verify all ADMIN_EMAILS receive email with correct teacher details and working links |
| Clicking Approve link updates DB and sends teacher email | APPR-01, APPR-03, APPR-04, EMAIL-03 | No route handler testing infrastructure | Click approve link; verify DB row shows `status=approved`, `reviewed_at`, `reviewed_by`; verify teacher inbox |
| Clicking Deny link updates DB and sends denial email | APPR-01, APPR-03, APPR-04, EMAIL-04 | No route handler testing infrastructure | Click deny link; verify DB row shows `status=denied`; verify teacher receives denial email with dates and leave type |
| Second click on approval link shows "already reviewed" page | APPR-02 | No route handler testing infrastructure | Click approval link twice; second click must redirect to `/reviewed` with no DB change, no second teacher email |
| Invalid/missing token shows error page | APPR-01 | No route handler testing infrastructure | `curl` the approve URL with wrong token; verify redirect to `/invalid`, no DB change |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
