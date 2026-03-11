# Teacher Time-Off Request System

## What This Is

A web application that lets teachers submit time-off requests and routes them to school administrators for approval or denial via email. Administrators manage requests through an email-action workflow and an admin dashboard, with automatic denial handling for requests that fall on blackout dates (e.g., state testing weeks, spring break).

## Core Value

Teachers can submit leave requests from any device and administrators can approve or deny them from their inbox — no login required for either party.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Teacher can submit a time-off request via a public form (name, email, dates, leave type, blackout flag, reason)
- [ ] Requests falling on blackout dates are auto-denied immediately with an email to the teacher
- [ ] Non-blackout requests are routed to all admin emails with Approve/Deny action buttons
- [ ] Admins can approve or deny a request via a tokenized link (no login required)
- [ ] Teacher receives a confirmation email when their request is approved or denied
- [ ] Admin dashboard shows all requests in a sortable, filterable table
- [ ] Admin dashboard allows managing blackout date ranges (add, view, delete)
- [ ] Admin dashboard is protected by a password stored in an environment variable
- [ ] Already-reviewed requests return a friendly "already reviewed" page if an admin clicks again

### Out of Scope

- Calendar API integration — admin manages blackout dates manually in the dashboard
- Teacher login / account system — form is fully public, no auth for teachers
- Real-time notifications / webhooks beyond email
- Mobile app — web-first only
- Role-based admin permissions — all admins share one password and approval secret

## Context

- Tech stack is fully specified: Next.js 14 App Router, Supabase (Postgres + JS client), Resend (email), Tailwind CSS
- School/district name is intentionally generic — operator customizes branding after deployment
- Two database tables: `requests` and `blackout_dates` (schemas fully defined by user)
- Approval flow uses a shared `APPROVAL_SECRET` token in query params — not per-user tokens
- Admin emails stored as comma-separated list in `ADMIN_EMAILS` env var
- Leave types: sick, personal, vacation, bereavement, jury_duty, professional_development, maternity_paternity
- Deployment target: Vercel

## Constraints

- **Tech Stack**: Next.js 14 App Router, Supabase JS, Resend, Tailwind CSS — no substitutions
- **Auth**: Simple cookie-based session for admin dashboard; tokenized query param for approval links
- **Email**: All email sent via Resend; sending domain must be verified by operator
- **Database**: Supabase Postgres only; schema is pre-defined by operator
- **Deployment**: Vercel (affects env var setup and API route conventions)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Token in approval URL (not per-admin JWT) | Simple to implement, no admin accounts needed | — Pending |
| Auto-deny on blackout flag (teacher self-reports) | Avoids need for date-range overlap check at submission | — Pending |
| Cookie-based admin session (no NextAuth) | Minimal dependencies, fits the simple use case | — Pending |
| HTML email templates (not React Email) | Keeps stack lean; Resend supports raw HTML | — Pending |

---
*Last updated: 2026-03-10 after initialization*
