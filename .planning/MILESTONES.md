# Milestones

## v1.0 MVP (Shipped: 2026-03-13)

**Phases completed:** 5 phases, 16 plans
**Timeline:** 2026-03-10 → 2026-03-13 (3 days)
**LOC:** ~1,745 TypeScript/TSX

**Key accomplishments:**
1. Next.js 15 scaffold with Supabase schema, typed DB stubs, and `server-only`-guarded lib modules (`lib/supabase`, `lib/email`, `lib/auth`)
2. Teacher submission form with `useActionState`, inline validation, and auto-denial for blackout dates
3. Tokenized admin email approval workflow — batch notify, idempotent approve/deny route handler, teacher confirmation emails
4. Password-protected admin dashboard with dual-gate CVE-2025-29927 mitigation, requests table with filter/sort, and blackout date CRUD
5. Duplicate submission guard (60s window), admin 500 fallback, bundle secret check script, and Resend DNS pre-launch checklist

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`

---

