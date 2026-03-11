# Feature Research

**Domain:** School Teacher Leave / Time-Off Request Management
**Researched:** 2026-03-10
**Confidence:** MEDIUM-HIGH — core features drawn from analysis of incumbent products (Frontline Aesop, Red Rover, LeaveBoard) plus standard leave-workflow UX patterns; school-specific nuances (blackout dates, no-login email actions) are well-documented in the ecosystem.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these makes the product feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Public submission form with all required fields | Teachers need a clear, zero-friction entry point; any friction causes abandonment or out-of-band requests (emails, phone calls) | LOW | Fields: name, email, dates (start/end), leave type, reason. Optional: notes/attachments. A single-page form is standard. |
| Leave type selector | Every incumbent system categorizes absences; admins need this for record-keeping, substitutes, and compliance | LOW | Types: sick, personal, vacation, bereavement, jury duty, professional development, maternity/paternity. Must not be free-text — free-text kills filtering later. |
| Date range input (start + end) | Single-day and multi-day requests are both common. Teachers miss class for 1-5 days frequently | LOW | Needs basic validation: end cannot be before start; no past-date submission (or warn clearly). |
| Submission confirmation (email + on-screen) | Without immediate feedback, teachers re-submit or call the office to verify receipt | LOW | On-screen: "Your request has been submitted." Email: same summary with request ID or reference. Both are expected. |
| Admin notification email on new request | Admins can't live inside a dashboard all day; email is the realistic interruption channel | LOW | Email to all configured admin addresses. Must include enough context to act without visiting the dashboard (teacher name, dates, leave type, reason). |
| One-click approve/deny from admin email | Admins in K-12 schools are overwhelmed; requiring a login just to approve one request causes abandonment and backlogs | MEDIUM | Tokenized links in email body. The core differentiated UX of this system. Approve and Deny are separate links in the same email. |
| Teacher notification on decision (approved/denied) | Teachers need to know if they should make alternate plans; silence is unacceptable | LOW | Separate email per outcome. Must include the leave dates and the decision clearly in the subject line, not buried in body. |
| Auto-deny on blackout dates with immediate email | Admins should never have to manually deny requests they've already blocked; surprises here damage trust | MEDIUM | Blackout check at submission time. Teacher gets immediate denial email with reason ("This period is a blackout date: [reason]."). Admin does not receive a notification for blackout-auto-denials — no noise for already-decided cases. |
| Admin dashboard — requests table | Admins need to audit history, find specific requests, and handle edge cases | MEDIUM | Sortable by date, filterable by status (pending/approved/denied), teacher name, leave type. Each row shows all key fields at a glance. |
| Admin dashboard — blackout date management | If admins can't self-serve on blackout dates, every testing week requires a developer | MEDIUM | Create a named blackout range (label + start date + end date). List existing ranges. Delete a range. No edit — delete and recreate is acceptable for v1. |
| Already-reviewed guard on approval links | Admins will click old links, forward emails, or approve twice accidentally without this | LOW | Tokenized link checks request status before acting. If already decided: show friendly page ("This request was already approved on [date]."). Never silently double-apply. |
| Admin dashboard password protection | Dashboard contains personal leave data; no auth at all is a compliance/trust issue | LOW | Single shared password via env var is appropriate for small school deployments. Cookie-based session. Not per-user auth — that's scope creep. |

### Differentiators (Competitive Advantage)

Features that make this system noticeably better than emailing the office or using generic HR tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Blackout date auto-denial at submission | Most systems require admins to manually deny requests that fall on blocked periods. Immediate automated denial with a clear reason saves admin time and gives teachers instant certainty | MEDIUM | The teacher self-reports the blackout flag, which simplifies the implementation: no need to run a date-range overlap query per submission. The flag is confirmed on submit via a simple check. |
| No-login email approval (for admins) | Frontline/Aesop and Red Rover require admins to log into a portal to approve. One-click-from-inbox is genuinely faster and meets admins where they are | MEDIUM | The shared `APPROVAL_SECRET` token in the URL is the mechanism. Not per-admin JWT — simpler to implement and sufficient for single-school deployment. |
| No-account teacher experience | Teachers don't need to remember credentials, reset passwords, or install anything. The form is fully public. This removes the #1 friction point for infrequent submitters | LOW | Pure form submission. Teachers identify themselves by name + email. No session required. |
| Blackout date label/reason in denial email | Systems that auto-deny without explanation generate support tickets. Including "Spring Break — district closed" or "State Testing Week" in the denial email closes the loop | LOW | Requires admins to add a label when creating a blackout range. Small extra field, high payoff. |
| Request status visible in admin table without drilling in | Most HR dashboards require clicking into each request to see its status. Showing Pending / Approved / Denied as a badge in the row lets admins triage at a glance | LOW | Status column with colored badge. Green/yellow/red or equivalent. |
| Sortable + filterable admin table | Raw chronological lists become unmanageable after 50+ requests. Filtering by status quickly shows pending items that need action | LOW | Filter by status and leave type. Sort by submitted date and leave start date. This is standard table UX but many school-specific tools omit it. |

### Anti-Features (Deliberately Not Building in v1)

Features that seem valuable but create more problems than they solve for this scope.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Teacher login / accounts | "Teachers should be able to see their own request history" | Adds auth complexity, password reset flows, email verification, and session management. For infrequent use (a few requests/year), it's not worth it. Teachers who need to track history can read their confirmation emails. | Confirmation email with full request summary. Reference number in the email subject. |
| Calendar API integration (Google/Outlook) | "Automatically block Google Calendar during approved leave" | OAuth scopes, token refresh, per-teacher calendar access, privacy concerns. Far outside the core loop. | Admin manages blackout dates manually in the dashboard — which is the source of truth. |
| Substitute teacher management | "We need to assign a sub when a teacher is approved" | A full sub-management system is a separate product (Frontline/Aesop is built around this). Out of scope without a substitute database, availability tracking, and notification system. | Out of scope. The system handles the request approval; sub coordination happens out-of-band. |
| Leave balance / accrual tracking | "Track how many sick days each teacher has used" | Requires per-teacher records, balance rules (which vary by district contract), carry-over logic, and payroll integration. Enormous complexity for v1. | Admins can export the request table and track balances in a spreadsheet or their existing HR system. |
| Multi-level approval chains | "Principal approves first, then HR approves" | Requires workflow state machines, role distinctions, and multiple token sets. A single shared admin decision model covers the vast majority of small school needs. | All admin emails receive the request simultaneously; first to click wins. |
| Mobile app | "Teachers want a native app" | Native app = app store review, push notification certificates, separate codebase. Responsive web form works fine on mobile for infrequent submission. | The form and dashboard are mobile-responsive web. No install required. |
| Real-time notifications / WebSockets | "Admins want live updates in the dashboard" | Adds WebSocket infrastructure for a use case where polling (or email) is sufficient. Admins check the dashboard; new requests are primarily handled via email. | Email is the notification channel. Dashboard refresh shows current state. |
| Per-admin accounts with RBAC | "Some admins should only view, not approve" | Requires user management, role definitions, and permission enforcement. Over-engineered for single-school use where all admins share authority. | Shared `APPROVAL_SECRET` covers the single-school trust model. |
| Attachment / document upload | "Teachers want to attach doctor's notes" | File storage (S3/Supabase Storage), upload validation, virus scanning, and access control add significant complexity. For v1, notes in the reason field are sufficient. | Free-text reason field. Attachments can be sent to the admin email separately. |
| Bulk approval in admin dashboard | "Approve all pending requests with one click" | Bulk actions require selection UI, confirmation dialogs, and batch update logic. Risk of accidental mass-approval. For most schools, the volume doesn't justify it. | Individual email approve/deny links handle normal volumes. Dashboard shows each request with direct action buttons if needed. |

---

## Feature Dependencies

```
[Public submission form]
    └──requires──> [Blackout date check at submit time]
                       └──requires──> [Blackout dates table/CRUD]

[Admin notification email]
    └──requires──> [Submission form]
    └──contains──> [Approve link] and [Deny link]
                       └──requires──> [Tokenized URL with APPROVAL_SECRET]
                                          └──requires──> [Already-reviewed guard]

[Teacher decision notification]
    └──requires──> [Approve/Deny action via tokenized link]

[Admin dashboard — requests table]
    └──enhances──> [Already-reviewed guard] (admins can see past decisions)
    └──enhances──> [Approval action] (fallback to dashboard when email is unavailable)

[Admin dashboard — blackout management]
    └──required by──> [Blackout date auto-denial]
    └──required by──> [Blackout label in denial email]

[Blackout auto-denial email to teacher]
    └──enhances──> [Blackout date label] (include reason in denial for clarity)
```

### Dependency Notes

- **Blackout dates table must exist before auto-denial logic:** The check at form submission reads from this table. Build and seed blackout CRUD before wiring the submission handler.
- **APPROVAL_SECRET token must be implemented before email links:** The approve/deny links are meaningless without the token validation endpoint.
- **Already-reviewed guard depends on request status in database:** Status must be updated atomically when an approval action is taken, before the guard can work reliably.
- **Admin dashboard enhances but does not replace email workflow:** The dashboard provides a fallback approval path (for cases where email links expire or admins prefer the dashboard), but the primary flow is email-first.

---

## MVP Definition

### Launch With (v1)

The minimum needed to replace the current paper/email process and validate the system.

- [ ] Public submission form (name, email, dates, leave type, reason, blackout acknowledgment flag) — the entry point; everything else depends on this
- [ ] Blackout date check at submission — auto-denial with email to teacher; no admin action required for these
- [ ] Admin notification email with approve/deny tokenized links — the core workflow
- [ ] Tokenized approve/deny action handler with already-reviewed guard — makes the email links actually work safely
- [ ] Teacher confirmation email on approval or denial — closes the loop; without this teachers are left in the dark
- [ ] Admin dashboard — requests table (sortable, filterable by status) — audit trail and fallback approval path
- [ ] Admin dashboard — blackout date CRUD (add named range, list, delete) — without this, the auto-denial has no data to check against
- [ ] Admin dashboard password protection (cookie session, env-var password) — personal leave data requires some access control

### Add After Validation (v1.x)

Features worth building once the core workflow is proven to work.

- [ ] Request detail view in dashboard — add when admins report needing to see full reason text without scrolling the table
- [ ] CSV export of request history — add when admins need to report to HR or district
- [ ] Resend confirmation email button in dashboard — add when teachers report not receiving their email (deliverability issues surface quickly in production)
- [ ] Deny with custom reason from dashboard — add when admins need to decline with context beyond "denied"

### Future Consideration (v2+)

Defer until there is direct feedback requesting these.

- [ ] Teacher request history (self-serve, no login) — would require a token-based "check my request" link sent in the confirmation email; defer until teachers ask for it
- [ ] Per-leave-type policy rules (e.g., personal leave requires 48h advance notice) — defer until specific policy enforcement is requested
- [ ] Analytics / absence trend reports — defer until administration asks for staffing insights
- [ ] Multi-school / district mode — defer unless expanding beyond single-school deployment

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Public submission form | HIGH | LOW | P1 |
| Blackout auto-denial + email | HIGH | MEDIUM | P1 |
| Admin email with approve/deny links | HIGH | MEDIUM | P1 |
| Teacher decision confirmation email | HIGH | LOW | P1 |
| Tokenized action handler + already-reviewed guard | HIGH | MEDIUM | P1 |
| Admin dashboard — requests table | HIGH | MEDIUM | P1 |
| Admin dashboard — blackout date CRUD | HIGH | MEDIUM | P1 |
| Admin dashboard password protection | MEDIUM | LOW | P1 |
| Deny with custom reason | MEDIUM | LOW | P2 |
| CSV export | MEDIUM | LOW | P2 |
| Resend confirmation email (admin action) | MEDIUM | LOW | P2 |
| Request detail view (modal/page) | LOW | LOW | P2 |
| Teacher request history (no-login) | LOW | MEDIUM | P3 |
| Per-leave-type policy rules | LOW | HIGH | P3 |
| Absence trend reports | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

The primary competitors are Frontline Absence & Time (formerly Aesop) and Red Rover — both full K-12 HR platforms. This system is intentionally narrower.

| Feature | Frontline (Aesop) | Red Rover | This System |
|---------|-------------------|-----------|-------------|
| Submission method | Web portal + mobile app (requires teacher login) | Web + mobile app (requires login) | Public web form — no teacher account |
| Approval method | Admin logs into portal or mobile app | Admin logs into portal or app | One-click email links — no admin login |
| Blackout / restricted dates | Admin-configured; requests may be blocked or flagged | Configurable restriction periods | Admin-configured date ranges; auto-denial at submission with immediate teacher email |
| Substitute management | Full substitute database, auto-fill, text alerts | Full sub management + automated text to subs | Out of scope |
| Leave balance tracking | Yes — accruals, balances, carry-over | Yes — integrates with payroll | Out of scope |
| Deployment complexity | Enterprise SaaS, district-wide rollout | Enterprise SaaS | Single Vercel deployment, env var config |
| Setup time | Weeks (implementation, training, data migration) | 22-day average implementation | Hours (env vars, Supabase project, Vercel deploy) |
| Cost | Enterprise pricing (~$3-6 per employee/year) | Enterprise pricing | Self-hosted; operational costs only |
| Target | Districts of 500+ employees | Districts of 200+ employees | Single school or small district |

**Positioning:** This system wins on simplicity and speed-to-deploy. It does not compete on substitute management, payroll integration, or compliance reporting. It competes on zero-friction for the core request-approval loop.

---

## Sources

- [Frontline Education — Absence Management](https://www.frontlineeducation.com/school-hcm-software/absence-management/) — feature overview (MEDIUM confidence; marketing page)
- [Frontline Absence Management Administrator Guide (PDF)](https://www.teachersoncall.com/hubfs/TeachersOnCall_April2024/pdf/TOC%20Absence%20Management%20Administrator%Guide_4.pdf) — workflow documentation (MEDIUM confidence)
- [Red Rover K-12 Absence Management](https://www.redroverk12.com/absence-management) — feature overview (MEDIUM confidence; marketing page)
- [Red Rover Best Practices for Substitute Coverage](https://www.redroverk12.com/blog/comprehensive-substitute-coverage-4-best-practices-to-adopt-right-now) — operational guidance (MEDIUM confidence)
- [HR Tech Institute — Blackout Dates in HR Tech](https://www.hr-tech-institute.com/blog/understanding-blackout-dates-in-hr-tech-what-every-professional-should-know) — blackout date patterns (MEDIUM confidence)
- [LeaveBoard — HR Dashboard](https://leaveboard.com/hr-dashboard/) — dashboard feature patterns (MEDIUM confidence)
- [Everhour — Leave Management Systems 2025](https://everhour.com/blog/leave-management-systems/) — market overview (LOW confidence; secondary aggregator)
- Industry experience with K-12 HR workflows and email-based approval patterns (underlying most decisions here)

---

*Feature research for: School Teacher Leave / Time-Off Request Management*
*Researched: 2026-03-10*
