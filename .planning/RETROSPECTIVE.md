# Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-13
**Phases:** 5 | **Plans:** 16

### What Was Built

- Next.js 15 scaffold with Supabase schema, typed DB stubs, and `server-only`-guarded lib modules
- Teacher submission form with `useActionState`, inline validation, and blackout auto-denial
- Tokenized admin email approval workflow — batch notify, idempotent approve/deny, teacher confirmation emails
- Password-protected admin dashboard with dual-gate CVE-2025-29927 mitigation, requests table with filter/sort, blackout date CRUD
- Duplicate submission guard (60s window), admin 500 fallback, bundle secret check script, Resend DNS pre-launch checklist

### What Worked

- **Phased dependency order** — each phase cleanly built on the previous one with no backtracking
- **Handwritten TypeScript DB types** — avoided Supabase CLI dependency, types matched exactly what was needed
- **Smoke test checkpoints (03-05, 04-04, 05-02)** — caught real issues (URL encoding of APPROVAL_SECRET, `formatDate` on ISO timestamps) that automated tests would have missed
- **Dual-gate auth pattern** — explicit CVE-2025-29927 mitigation was fast to implement once identified and gave high confidence
- **server-only sentinel** — zero effort, guaranteed security boundary; no incidents but load-bearing

### What Was Inefficient

- Phase 1 and 2 plan checkboxes in ROADMAP.md were never marked complete (roadmap tracking inconsistency)
- Some SUMMARY.md files used different schema styles (some YAML, some mixed) — inconsistent but not blocking

### Patterns Established

- `redirect()` outside `try/catch` everywhere — NEXT_REDIRECT must not be swallowed
- `T00:00:00` suffix on ISO date strings for local timezone parsing — prevents off-by-one-day bug
- `useActionState` + `defaultValue` on all inputs — progressive enhancement, values survive server roundtrip
- `type`-only import in middleware for server-only types — avoids Edge runtime crash
- `resend.batch.send()` per admin, not a single multi-recipient email — unique approve/deny URLs per recipient

### Key Lessons

- **Test the middleware bypass early.** CVE-2025-29927 affects any Next.js middleware-only auth. The `curl -H x-middleware-subrequest` test should be a first-class step in any admin auth plan.
- **URL-encode secrets in query params.** `encodeURIComponent(APPROVAL_SECRET)` is required — secrets with special chars break token validation silently.
- **`.maybeSingle()` not `.single()` for optional lookups.** `.single()` throws on no match; `.maybeSingle()` returns null. Using the wrong one causes cryptic errors.
- **Smoke test checkpoints are worth the friction.** 3 of 5 phases ended with a manual checkpoint. Each one caught something that code review alone wouldn't have.

### Cost Observations

- Model mix: 100% sonnet (all executor, verifier, and researcher agents)
- Sessions: ~8 conversation turns across 3 days
- Notable: Wave-based parallel execution not needed this milestone (max 1 plan per wave), but checkpoint handling worked smoothly

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | LOC |
|-----------|--------|-------|------|-----|
| v1.0 MVP | 5 | 16 | 3 | ~1,745 |
