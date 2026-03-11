# Requirements: Teacher Time-Off Request System

**Defined:** 2026-03-10
**Core Value:** Teachers can submit leave requests from any device and administrators can approve or deny them from their inbox — no login required for either party.

## v1 Requirements

### Submission Form

- [ ] **FORM-01**: Teacher can submit a request with full name, work email, start date, end date, leave type (7 options), blackout flag (yes/no), and optional reason
- [ ] **FORM-02**: Form displays inline validation errors for all required fields before submission
- [ ] **FORM-03**: Submit button is disabled on click to prevent duplicate submissions
- [ ] **FORM-04**: Form rejects end dates before start date and start dates in the past
- [ ] **FORM-05**: Teacher is redirected to a confirmation page after successful submission

### Request Processing

- [ ] **REQ-01**: All submissions are saved to the `requests` table in Supabase
- [ ] **REQ-02**: Blackout-flagged requests are immediately set to `auto_denied` status — no admin email sent
- [ ] **REQ-03**: Non-blackout requests are set to `pending` status and trigger admin notification email

### Email Notifications

- [ ] **EMAIL-01**: Auto-denied teacher receives email explaining their dates fall on a blackout period
- [ ] **EMAIL-02**: All admin addresses (from `ADMIN_EMAILS` env var) receive request details with tokenized Approve and Deny buttons
- [ ] **EMAIL-03**: Teacher receives a warm approval confirmation email with their dates and leave type
- [ ] **EMAIL-04**: Teacher receives a respectful denial email with their dates and leave type

### Approval Workflow

- [ ] **APPR-01**: Approval API validates `APPROVAL_SECRET` token on every inbound request
- [ ] **APPR-02**: Approval API returns a friendly "already reviewed" page if request status is not `pending` (idempotency guard)
- [ ] **APPR-03**: Approval action updates `status`, `reviewed_at`, and `reviewed_by` (admin email passed as query param)
- [ ] **APPR-04**: Teacher confirmation email is sent only after a successful DB status update

### Admin Dashboard

- [ ] **ADMIN-01**: Dashboard is protected by a password stored in `ADMIN_PASSWORD` env var with httpOnly cookie session
- [ ] **ADMIN-02**: Admin auth is verified in both middleware and the admin layout (CVE-2025-29927 mitigation)
- [ ] **ADMIN-03**: Requests tab shows all requests with columns: Teacher Name, Email, Leave Type, Start Date, End Date, Reason, Blackout?, Status (color-coded badge), Submitted Date, Reviewed By
- [ ] **ADMIN-04**: Requests table is filterable by status (All / Pending / Approved / Denied / Auto-Denied)
- [ ] **ADMIN-05**: Requests table columns are sortable by clicking column headers
- [ ] **ADMIN-06**: Blackout Dates tab shows all date ranges with label, start date, and end date
- [ ] **ADMIN-07**: Admin can add a blackout date range with a label, start date, and end date
- [ ] **ADMIN-08**: Admin can delete any blackout date range

### Security

- [ ] **SEC-01**: Supabase anon key is never exposed to the browser — all DB queries run server-side only
- [ ] **SEC-02**: `APPROVAL_SECRET`, `ADMIN_PASSWORD`, and `SUPABASE_SERVICE_ROLE_KEY` never use the `NEXT_PUBLIC_` prefix

## v2 Requirements

### Admin Enhancements

- **ADM2-01**: Admin can deny a request with a custom reason visible in the teacher denial email
- **ADM2-02**: Admin dashboard supports CSV export of the full request history

### Teacher Experience

- **TCH2-01**: Teacher can view their own past requests via a token-based link (no account required)

### Hardening

- **HARD2-01**: Rate limiting on the public form submission endpoint (e.g., Upstash Redis)
- **HARD2-02**: Per-leave-type advance notice policy rules enforced at submission

## Out of Scope

| Feature | Reason |
|---------|--------|
| Calendar API integration (Google/Outlook) | Admin manages blackout dates manually — no sync needed for v1 |
| Teacher login / account system | Public form with no credentials eliminates friction for infrequent users |
| Real-time notifications / WebSockets | Email is the notification channel; real-time adds infrastructure complexity |
| Mobile app | Web-first; responsive Tailwind layout serves mobile browsers |
| Role-based admin permissions | All admins share one password and approval secret — sufficient for single-school use |
| React Email components | Raw HTML in Resend keeps the stack lean; 4 simple email types don't justify the build complexity |
| NextAuth / OAuth for admin | Single shared password (iron-session) is the right tool for this use case |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| FORM-01 | Phase 2 | Pending |
| FORM-02 | Phase 2 | Pending |
| FORM-03 | Phase 2 | Pending |
| FORM-04 | Phase 2 | Pending |
| FORM-05 | Phase 2 | Pending |
| REQ-01 | Phase 2 | Pending |
| REQ-02 | Phase 2 | Pending |
| EMAIL-01 | Phase 2 | Pending |
| REQ-03 | Phase 3 | Pending |
| EMAIL-02 | Phase 3 | Pending |
| APPR-01 | Phase 3 | Pending |
| APPR-02 | Phase 3 | Pending |
| APPR-03 | Phase 3 | Pending |
| APPR-04 | Phase 3 | Pending |
| EMAIL-03 | Phase 3 | Pending |
| EMAIL-04 | Phase 3 | Pending |
| ADMIN-01 | Phase 4 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| ADMIN-03 | Phase 4 | Pending |
| ADMIN-04 | Phase 4 | Pending |
| ADMIN-05 | Phase 4 | Pending |
| ADMIN-06 | Phase 4 | Pending |
| ADMIN-07 | Phase 4 | Pending |
| ADMIN-08 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

Note: Phase 5 (Polish and Pre-Launch Hardening) covers no net-new v1 requirements. It verifies and hardens behaviors already delivered by Phases 1-4. All 26 v1 requirements are assigned to exactly one functional phase.

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation — traceability complete*
