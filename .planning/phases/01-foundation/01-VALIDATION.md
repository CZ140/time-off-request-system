---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — greenfield project; Wave 0 installs nothing (not needed in Phase 1) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx next build` |
| **Full suite command** | `npx next build && grep -r "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY\|NEXT_PUBLIC_APPROVAL_SECRET\|NEXT_PUBLIC_ADMIN_PASSWORD" . --include="*.env*" --include="*.ts" --include="*.tsx" || echo "No violations found"` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build`
- **After every plan wave:** Run `npx next build` + manual env audit
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | — | smoke | `npx next build` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | SEC-01 | build verification | `npx next build` (fails if server-only violated) | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | SEC-01 | build verification | `npx next build` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | SEC-02 | manual / grep | `grep -r "NEXT_PUBLIC_" .env.local .env.example` | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Bootstrapped Next.js 15 app exists (`package.json` with `next@^15`) — required before `next build` can run
- [ ] `.env.example` — documents all required env var names without values (reference for SEC-02 audit)
- [ ] All stub files (`lib/supabase/server.ts`, `lib/email/send.ts`, `lib/auth/session.ts`) have valid TypeScript (no build errors)

*Note: No unit test framework is needed in Phase 1 — Phase 1 delivers stubs and schema only. Behavioral tests belong to Phases 2–4.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No `NEXT_PUBLIC_` prefix on secrets | SEC-02 | Configuration audit, not runtime behavior | Open `.env.local` and `.env.example`; confirm `APPROVAL_SECRET`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` have no `NEXT_PUBLIC_` prefix |
| Supabase tables exist with correct schema | — | Requires live Supabase project | Run migrations, open Supabase Table Editor, verify `requests` and `blackout_dates` columns match schema |
| Vercel deployment succeeds | — | Requires live Vercel project | Push to main, check Vercel dashboard for green deploy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
