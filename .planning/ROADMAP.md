# Roadmap: Teacher Time-Off Request System

## Overview

Five phases build from a clean foundation outward to user-facing features. Phase 1 establishes project scaffolding, database schema, and security conventions that every later phase depends on. Phase 2 delivers the teacher submission form end-to-end including blackout auto-denial. Phase 3 completes the email approval workflow — the core differentiator of the system. Phase 4 adds the admin dashboard and blackout date management. Phase 5 verifies pre-launch readiness: edge cases, email deliverability, and security audit.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Project scaffold, database schema, lib modules, and security conventions established
- [ ] **Phase 2: Teacher Form and Auto-Denial** - Public submission form with validation, DB write, and blackout auto-denial flow
- [ ] **Phase 3: Email Approval Workflow** - Admin notification emails and tokenized approve/deny Route Handler with idempotency
- [ ] **Phase 4: Admin Dashboard** - Password-protected dashboard with requests table and blackout date CRUD
- [ ] **Phase 5: Polish and Pre-Launch Hardening** - Edge case handling, email deliverability verification, security audit, UX gaps

## Phase Details

### Phase 1: Foundation
**Goal**: The project skeleton exists with correct security posture so every subsequent phase builds on a safe, consistent base
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. Next.js 15 app boots locally and deploys to Vercel with zero errors
  2. Supabase `requests` and `blackout_dates` tables exist with the correct schema and all queries run server-side only (anon key never in browser)
  3. All secrets (`APPROVAL_SECRET`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`) use no `NEXT_PUBLIC_` prefix and the env var structure is documented
  4. `lib/supabase/server.ts`, `lib/email/send.ts`, and `lib/auth/session.ts` stubs exist with correct import boundaries
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Scaffold Next.js 15 app, install dependencies, create directory structure and env files (SEC-02)
- [ ] 01-02-PLAN.md — Write Supabase SQL migration and handwritten TypeScript database types (SEC-01)
- [ ] 01-03-PLAN.md — Create lib module stubs with server-only guards (SEC-01, SEC-02)

### Phase 2: Teacher Form and Auto-Denial
**Goal**: A teacher can submit a leave request from any device and immediately receive feedback — either a submission confirmation or an auto-denial if the request falls on a blackout period
**Depends on**: Phase 1
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, REQ-01, REQ-02, EMAIL-01
**Success Criteria** (what must be TRUE):
  1. Teacher can fill out the form with name, email, dates, leave type, blackout flag, and reason and submit successfully
  2. Form shows inline validation errors for missing required fields, end date before start date, and past start dates before allowing submission
  3. Submit button disables on click and the form cannot be submitted twice
  4. Submitted request appears in the Supabase `requests` table with correct status (`pending` or `auto_denied`)
  5. Teacher whose request is flagged as a blackout date receives an auto-denial email and is redirected to a confirmation page; no admin email is sent
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Server action (submitRequest), FormState type, and auto-denial email template
- [ ] 02-02-PLAN.md — Teacher form UI (page.tsx) and shared confirmation page

### Phase 3: Email Approval Workflow
**Goal**: Admins can approve or deny any pending request directly from their inbox with a single click, and the teacher receives a confirmation email immediately after
**Depends on**: Phase 2
**Requirements**: REQ-03, EMAIL-02, APPR-01, APPR-02, APPR-03, APPR-04, EMAIL-03, EMAIL-04
**Success Criteria** (what must be TRUE):
  1. All addresses in `ADMIN_EMAILS` receive a notification email containing the teacher's details and working Approve and Deny buttons when a non-blackout request is submitted
  2. Clicking an Approve or Deny link validates the `APPROVAL_SECRET` token, updates the request status in the database, and sends the teacher a confirmation email
  3. Clicking an approval link a second time (or with the wrong token) does not change any data and returns a friendly "already reviewed" page instead of an error
  4. Teacher receives a warm approval or respectful denial email only after the database update succeeds — never before
**Plans**: 5 plans

Plans:
- [ ] 03-01-PLAN.md — Email shared utils and three new templates (admin notification, approval confirmation, denial confirmation)
- [ ] 03-02-PLAN.md — Update submitRequest server action to send batch admin emails for non-blackout submissions
- [ ] 03-03-PLAN.md — Implement /api/approve GET route handler (token validation, idempotency, DB update, teacher email)
- [ ] 03-04-PLAN.md — Create /reviewed and /invalid pages for approval link landing
- [ ] 03-05-PLAN.md — Pre-flight build check and full end-to-end smoke test checkpoint

### Phase 4: Admin Dashboard
**Goal**: Admins can review the full request history in a filterable table and manage blackout date ranges, all behind a password-protected page that is safe from middleware bypass attacks
**Depends on**: Phase 3
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08
**Success Criteria** (what must be TRUE):
  1. Navigating to `/admin` without being logged in redirects to the login page; entering the correct password grants access via an httpOnly cookie session
  2. Admin auth is verified in both middleware and the admin layout, so the dashboard cannot be accessed by sending an `x-middleware-subrequest` bypass header
  3. Requests tab shows all requests with the correct columns, color-coded status badges, and allows filtering by status and sorting by any column header
  4. Blackout Dates tab lists all date ranges and allows adding a new range (label, start date, end date) and deleting any existing range
**Plans**: TBD

### Phase 5: Polish and Pre-Launch Hardening
**Goal**: The system is ready for real use — edge cases are handled gracefully, emails are deliverable, and no security property can be violated by normal or adversarial use
**Depends on**: Phase 4
**Requirements**: (no new v1 requirements — this phase verifies and hardens behaviors delivered in Phases 1-4)
**Success Criteria** (what must be TRUE):
  1. Admin requests table shows a friendly empty state when no requests exist rather than a blank table
  2. Approve and Deny buttons in admin notification emails render as styled HTML buttons, not raw URLs
  3. Resend sending domain has verified SPF/DKIM DNS records and a test email delivers to an inbox (not spam)
  4. No secret environment variable appears in any client bundle (verified via build output inspection)
  5. Submitting the public form multiple times rapidly does not create duplicate `pending` requests or send duplicate admin emails
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/3 | In Progress|  |
| 2. Teacher Form and Auto-Denial | 1/2 | In Progress|  |
| 3. Email Approval Workflow | 1/5 | In Progress|  |
| 4. Admin Dashboard | 0/? | Not started | - |
| 5. Polish and Pre-Launch Hardening | 0/? | Not started | - |
