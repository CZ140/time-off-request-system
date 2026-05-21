# Teacher Time-Off Request System

## What This Is

A web application that lets teachers submit time-off requests and routes them to school administrators for approval or denial via email. Administrators manage requests through an email-action workflow and an admin dashboard, with automatic denial handling for requests that fall on blackout dates (e.g., state testing weeks, spring break).

## Core Value

Teachers can submit leave requests from any device and administrators can approve or deny them from their inbox — no login required for either party.

## Current Milestone: v1.1 Post-Audit Hardening

**Goal:** Close all security, reliability, and code quality gaps identified in the senior audit — no new features, only hardening of what's built.

**Target features:**
- HMAC-signed approval tokens and server-side blackout enforcement (security correctness)
- HTTP security headers, email format validation, env var startup validation
- Orphaned request fix, error surfacing, approval email personalization, sendBatch abstraction
- Deduplication of shared utilities, package name cleanup
- Vitest test suite + GitHub Actions CI
- Admin table reason expand-in-place, end date min attribute

## Requirements

### Validated

- ✓ Teacher can submit a time-off request via a public form (name, email, dates, leave type, blackout flag, reason) — v1.0
- ✓ Requests falling on blackout dates are auto-denied immediately with an email to the teacher — v1.0
- ✓ Non-blackout requests are routed to all admin emails with Approve/Deny action buttons — v1.0
- ✓ Admins can approve or deny a request via a tokenized link (no login required) — v1.0
- ✓ Teacher receives a confirmation email when their request is approved or denied — v1.0
- ✓ Admin dashboard shows all requests in a sortable, filterable table — v1.0
- ✓ Admin dashboard allows managing blackout date ranges (add, view, delete) — v1.0
- ✓ Admin dashboard is protected by a password stored in an environment variable — v1.0
- ✓ Already-reviewed requests return a friendly "already reviewed" page if an admin clicks again — v1.0

### Active (v1.1)

- [ ] **SEC-01** System enforces blackout dates server-side via DB overlap query, independent of teacher's self-reported value
- [ ] **SEC-02** Admin approval/denial URLs use HMAC-SHA256 tokens scoped to a specific request ID and action
- [ ] **SEC-03** Server-side email format validation rejects structurally invalid teacher email addresses
- [ ] **SEC-04** HTTP security headers applied to all responses (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [ ] **SEC-05** Application validates all required env vars at startup and fails with descriptive messages if any are missing
- [ ] **REL-01** Email failure after successful DB insert logs the request ID and returns a distinct error state rather than orphaning the row
- [ ] **REL-02** deleteBlackoutDate surfaces DB errors to the admin UI instead of silently swallowing them
- [ ] **REL-03** Approval confirmation email includes teacher name, leave type, start date, and end date
- [ ] **REL-04** /reviewed page distinguishes first-time admin action from idempotent re-click via URL flag
- [ ] **REL-05** All email sending routes through lib/email/send.ts; direct Resend instantiation in Server Actions replaced with sendBatch export
- [ ] **QUAL-01** LEAVE_TYPE_LABELS and formatDate imported from lib/email/utils.ts everywhere; local copies removed
- [ ] **QUAL-02** package.json name field updated to remove -temp suffix
- [ ] **TEST-01** Vitest configured with server-only module mocking
- [ ] **TEST-02** submitRequest validation logic has unit test coverage for all branches
- [ ] **TEST-03** HMAC token generation and verification have unit test coverage
- [ ] **TEST-04** Blackout date overlap detection has unit test coverage
- [ ] **TEST-05** GitHub Actions CI runs tsc, eslint, and vitest on every push/PR
- [ ] **UX-01** Reason column in admin table is expandable in-place
- [ ] **UX-02** End date input min attribute dynamically bound to selected start date

### Out of Scope

- Calendar API integration — admin manages blackout dates manually in the dashboard
- Teacher login / account system — form is fully public, no auth for teachers
- Real-time notifications / webhooks beyond email
- Mobile app — web-first only
- Role-based admin permissions — all admins share one password and approval secret

## Context

**v1.0 shipped 2026-03-13**

- Tech stack: Next.js 15 App Router, Supabase (Postgres + JS client), Resend (email), Tailwind CSS, iron-session
- ~1,745 lines of TypeScript/TSX across 16 plans in 5 phases
- School/district name is intentionally generic — operator customizes branding after deployment
- Two database tables: `requests` and `blackout_dates`
- Approval flow uses a shared `APPROVAL_SECRET` token in query params — not per-user tokens
- Admin emails stored as comma-separated list in `ADMIN_EMAILS` env var
- Leave types: sick, personal, vacation, bereavement, jury_duty, professional_development, maternity_paternity
- Deployment target: Vercel
- All secrets are server-only (no `NEXT_PUBLIC_` prefix); enforced by `server-only` sentinel imports

## Constraints

- **Tech Stack**: Next.js 15 App Router, Supabase JS, Resend, Tailwind CSS — no substitutions
- **Auth**: Simple cookie-based session (iron-session) for admin dashboard; tokenized query param for approval links
- **Email**: All email sent via Resend; sending domain must be verified by operator
- **Database**: Supabase Postgres only; schema is pre-defined by operator
- **Deployment**: Vercel (affects env var setup and API route conventions)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Token in approval URL (not per-admin JWT) | Simple to implement, no admin accounts needed | ✓ Good — worked cleanly, idempotency handled in route handler |
| Auto-deny on blackout flag (teacher self-reports) | Avoids need for date-range overlap check at submission | ✓ Good — simple and reliable; admin manages dates manually |
| Cookie-based admin session (iron-session, no NextAuth) | Minimal dependencies, fits the simple use case | ✓ Good — lightweight, no config overhead |
| HTML email templates (not React Email) | Keeps stack lean; Resend supports raw HTML | ✓ Good — fast to write, no extra dep, full control |
| Dual-gate auth (middleware + protected layout) | CVE-2025-29927 — middleware-only auth is bypassable via x-middleware-subrequest header | ✓ Good — essential security fix, confirmed by curl test |
| `server-only` sentinel on all lib modules | Build-time enforcement of SEC-01 (no accidental client-side import) | ✓ Good — caught zero incidents but guarantees are load-bearing |
| Duplicate submission guard via `.maybeSingle()` (60s window) | Prevents double-insert on rapid re-submit without requiring per-session state | ✓ Good — verified in smoke test |
| `resend.batch.send()` for multi-admin notification | One API call, one email per admin, unique approve/deny URLs per email | ✓ Good — clean and scalable for small admin counts |

---
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:** Requirements invalidated → move to Out of Scope. Requirements validated → move to Validated with phase reference. New requirements → add to Active. Decisions to log → add to Key Decisions.

**After each milestone:** Full review of all sections. Core Value check. Audit Out of Scope. Update Context.

---
*Last updated: 2026-05-21 — v1.1 milestone started (post-audit hardening)*
