---
phase: 2
slug: teacher-form-and-auto-denial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — no test config detected |
| **Config file** | none — Wave 0 covers any gaps |
| **Quick run command** | `next build` |
| **Full suite command** | `next build` + manual browser form test |
| **Estimated runtime** | ~30 seconds (build) + ~5 min manual |

---

## Sampling Rate

- **After every task commit:** Run `next build`
- **After every plan wave:** Run `next build` + submit a test form in `npm run dev` for each requirement in that wave
- **Before `/gsd:verify-work`:** All 8 requirements manually verified
- **Max feedback latency:** 30 seconds (automated), ~5 min (manual wave gate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | FORM-01, FORM-02, FORM-03, FORM-04 | smoke | `next build` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | FORM-05, REQ-01, REQ-02 | smoke + manual | `next build` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | EMAIL-01 | smoke + manual | `next build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/email/templates/` directory — does not exist yet; create before implementing EMAIL-01
- [ ] `next build` must pass with zero TypeScript errors after each task — enforced via `strict: true` in tsconfig (already confirmed from Phase 1)

*Note: No unit test framework needed — Phase 2 has no pure functions complex enough to warrant unit tests; all logic is integration-level.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 8 fields accepted and stored | FORM-01 | UI + DB integration | Submit form in browser, check Supabase dashboard |
| Inline errors appear for missing fields | FORM-02 | DOM state | Submit empty form; verify error messages appear per field |
| Submit button disabled while submitting | FORM-03 | UI state during network | Submit form and observe button state during network delay |
| Past/invalid date rejected | FORM-04 | UI + validation | Submit with start date yesterday; submit with end before start |
| Redirect to `/confirmation` after success | FORM-05 | Navigation | Submit valid form; verify URL = `/confirmation?status=submitted` |
| Row in `requests` table | REQ-01 | DB state | Check Supabase Table Editor after successful submit |
| Blackout → `auto_denied`, no admin email | REQ-02 | DB + email | Submit with blackout=Yes; verify `status=auto_denied` in Supabase; verify no admin email |
| Auto-denial email received | EMAIL-01 | Email delivery | Submit blackout request; check test email inbox for correct name/dates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (automated)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
