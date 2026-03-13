---
phase: 5
slug: polish-and-pre-launch-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework installed in this project |
| **Config file** | none |
| **Quick run command** | N/A (manual verification) |
| **Full suite command** | `bash scripts/check-bundle-secrets.sh` |
| **Estimated runtime** | ~60 seconds (includes full build) |

---

## Sampling Rate

- **After every task commit:** Manual visual verification of changed behavior
- **After every plan wave:** Run `bash scripts/check-bundle-secrets.sh` (once script exists)
- **Before `/gsd:verify-work`:** Full suite must be green; all manual checks completed
- **Max feedback latency:** ~60 seconds for bundle check; immediate for manual UI checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Criterion | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-----------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | #5 duplicate guard | Manual (rapid submit) | N/A | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | #3 Resend DNS docs | Manual (inspect .env.example) | N/A | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 1 | #4 bundle secrets | Automated shell script | `bash scripts/check-bundle-secrets.sh` | ❌ W0 | ⬜ pending |
| 5-04-01 | 04 | 1 | Admin dashboard error | Manual (simulate DB error) | N/A | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-bundle-secrets.sh` — bundle secret leak check (criterion #4); does not exist yet

*All other criteria are verified manually. No test framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Criterion | Why Manual | Test Instructions |
|----------|-----------|------------|-------------------|
| Empty state in admin requests table | #1 | Already implemented; visual check only | Navigate to admin dashboard with no requests; confirm "No requests found." is displayed |
| Styled HTML buttons in admin notification email | #2 | Email rendering; no test framework | Approve/deny a request; confirm email shows green/red styled buttons, not raw URLs |
| Resend SPF/DKIM DNS records verified | #3 | External DNS infrastructure | Log into Resend dashboard; confirm domain status is "Verified"; send test email to personal inbox; confirm inbox delivery (not spam) |
| Duplicate submission guard | #5 | No test framework; requires rapid form submission | Submit the public request form twice within 60 seconds with same email/dates; confirm only 1 row in DB and only 1 admin email sent |
| Admin dashboard DB error fallback | Admin hardening | Requires DB error simulation | Temporarily break Supabase credentials; confirm admin dashboard shows "Unable to load data. Please refresh." instead of 500 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
