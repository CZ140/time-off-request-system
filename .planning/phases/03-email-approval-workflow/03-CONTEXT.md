# Phase 3: Email Approval Workflow - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Non-blackout requests trigger admin notification emails with tokenized Approve/Deny links. Clicking a link validates the token, updates the request status in the DB, and sends the teacher a confirmation email. Admins who click an already-actioned link get a friendly informational page. Admin dashboard UI is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Admin notification email
- Full details in the email: teacher name, teacher email, leave type, start date, end date, reason, and blackout flag
- Always show the reason field — display "(none provided)" when the teacher left it blank
- Approve and Deny actions rendered as styled HTML buttons: green Approve button, red Deny button (anchor tags styled as buttons — consistent with existing email template visual style)
- Subject line: "New leave request: [Teacher Name]"

### Multi-admin sending
- Use `resend.batch.send()` to send a separate email to each address in `ADMIN_EMAILS`
- Each admin's email contains approval URLs with their address baked in: `?admin=their@email.com`
- `reviewed_by` in the DB stores the specific admin email extracted from the query param
- First click wins: idempotency check (status !== 'pending') catches any concurrent second click — second admin gets the "already reviewed" page, no duplicate teacher emails sent

### Approval URL structure
- Route: `GET /api/approve`
- Params: `?action=approve|deny&id={requestId}&token={APPROVAL_SECRET}&admin={adminEmail}`
- Token validated server-side against `process.env.APPROVAL_SECRET` on every request

### "Already reviewed" page
- New dedicated route: `/reviewed` (not reusing `/confirmation`)
- Shows: current status (Approved / Denied), teacher name, dates, leave type, and which admin reviewed it
- Invalid or missing token → separate error page (distinct from "already reviewed")

### Teacher confirmation emails
- Approval email: minimal — "Your request has been approved." No dates, leave type, or admin attribution echoed back
- Denial email: respectful and direct — acknowledges the request, states it was denied, echoes dates and leave type; no next-steps guidance or contact suggestion (denial is final)
- Subject lines: "Your time-off request has been approved" / "Your time-off request has been denied"
- No mention of which admin took the action in either email

### Claude's Discretion
- Exact Tailwind styling on the `/reviewed` and error pages
- HTML email layout and wording for admin notification and teacher confirmation templates (warm/professional tone, operator can edit template files)
- Exact error page copy for invalid/missing token
- How to pass request details to the `/reviewed` page (redirect with query params vs. server-rendered fetch by ID)

</decisions>

<specifics>
## Specific Ideas

- The "already reviewed" page should show full request context so admins aren't left wondering what happened — they get status, teacher name, dates, and who acted on it
- Invalid token and already-reviewed are different failure modes and deserve different pages

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/email/send.ts` → `sendEmail({ to, subject, html })` — existing wrapper; `to` accepts `string | string[]`; use `resend.batch.send()` directly for per-admin sending
- `lib/email/templates/auto-denial.ts` → established HTML template pattern (TypeScript function returning HTML string, `formatDate()` helper, `LEAVE_TYPE_LABELS` map) — replicate for all three new templates
- `lib/supabase/server.ts` → `createClient()` — for DB read (fetch request by ID) and write (update status, reviewed_at, reviewed_by) in the route handler
- `types/database.ts` → `LeaveType`, `RequestStatus` — use for typed DB operations

### Established Patterns
- All DB queries server-side only (`server-only` guard) — approval handler stays in `app/api/approve/route.ts`
- Email templates live in `lib/email/templates/` as separate TypeScript files — add `admin-notification.ts`, `approval-confirmation.ts`, `denial-confirmation.ts`
- Plain Tailwind CSS, no component library — apply to `/reviewed` and error pages

### Integration Points
- `app/api/approve/route.ts` — stub ready to be replaced with full GET handler
- New: `app/reviewed/page.tsx` — "already reviewed" page
- New: `app/invalid/page.tsx` (or similar) — invalid token error page
- New: `lib/email/templates/admin-notification.ts` — admin email with Approve/Deny buttons
- New: `lib/email/templates/approval-confirmation.ts` — teacher approval email
- New: `lib/email/templates/denial-confirmation.ts` — teacher denial email
- The `submitRequest` server action (`app/(public)/actions.ts`) needs updating: after successful DB insert for non-blackout requests, trigger `resend.batch.send()` to all ADMIN_EMAILS

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-email-approval-workflow*
*Context gathered: 2026-03-11*
