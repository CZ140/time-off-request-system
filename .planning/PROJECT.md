# Teacher Time-Off Request System

## What This Is

A web application that lets teachers submit time-off requests and routes them to school administrators for approval or denial via email. Administrators manage requests through an email-action workflow and an admin dashboard, with automatic denial handling for requests that fall on blackout dates (e.g., state testing weeks, spring break).

## Core Value

Teachers can submit leave requests from any device and administrators can approve or deny them from their inbox — no login required for either party.

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

### Active

(None — v1.0 delivered all planned requirements. Define new requirements for next milestone with `/gsd:new-milestone`.)

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
*Last updated: 2026-03-13 after v1.0 milestone*
