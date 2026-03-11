# Phase 2: Teacher Form and Auto-Denial - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Public submission form with validation, DB write, and blackout auto-denial flow. A teacher fills out the form, submits, and is immediately redirected to a confirmation page — or auto-denied if they flagged a blackout period. Admin notification emails are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Form Layout
- Centered white card on a light gray page background
- No page header or school name above the card — card title ("Request Time Off") is sufficient
- Single-column layout, all fields stacked vertically
- No component library — plain Tailwind classes throughout

### Form Fields and Controls
- Leave Type: radio buttons (all 7 options visible, not a dropdown)
- Date fields: native HTML `<input type="date">` — no third-party date picker
- Reason field: optional, labeled clearly as such
- Field order: Full Name → Work Email → Start Date → End Date → Leave Type → Blackout Period → Reason → Submit

### Blackout Flag Field
- Presented as a Yes/No radio group with explanation text: "Blackout dates are school periods when leave is not permitted (e.g., state testing weeks, spring break)."
- Required — teacher must explicitly select Yes or No before submitting (no default)
- Positioned after Leave Type, before Reason
- When "Yes" is selected: show an inline amber/yellow warning — "Your request will be automatically denied. You'll receive a confirmation email."

### Confirmation & Denial Pages
- Both use the same `/confirmation` route — page content differs based on outcome
- Successful submission page: minimal — checkmark icon, brief message ("Your request has been received"), note that they'll receive a response via email
- Auto-denial page: warm and empathetic — explains dates fall on a blackout period, confirms a confirmation email is on the way
- Both pages include a "Submit another request" link back to the form

### Email Templates
- Templates live in `lib/email/templates/` as separate files — editable independently of logic code
- Tone: warm and friendly (Claude writes initial copy)
- Auto-denial email content: addresses teacher by name, echoes leave type and date range, explains the blackout reason gently
- No "next steps" or contact suggestion — the denial is final and policy-based
- Sender: `RESEND_FROM` env var (operator-configured) — no hardcoded school name in template

### Validation Behavior
- Inline errors shown on submit attempt (not on blur)
- Client-side: required fields, end date not before start date, start date not in the past
- Server-side: same rules validated in the Server Action/API route before DB write

### Claude's Discretion
- Exact Tailwind classes, spacing, and typography
- Loading/disabled state design for the Submit button
- Exact wording of email body (warm and friendly, operator can edit template file)
- Error message copy for each validation rule
- How to pass outcome (submitted vs auto-denied) to the /confirmation page (search params, redirect with status, etc.)

</decisions>

<specifics>
## Specific Ideas

- Email templates should be easily editable at any time — store as separate files in `lib/email/templates/`, not inline strings in route handlers
- Blackout inline warning: amber/yellow color to signal caution without being alarming
- The confirmation page should handle both outcomes at one URL — cleaner than two separate routes

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/server.ts` → `createClient()` — used by the Server Action or API route to write to `requests` table
- `lib/email/send.ts` → `sendEmail({ to, subject, html })` — called after DB write for auto-denial email
- `types/database.ts` → `LeaveType`, `RequestStatus`, `Database` — use for typed insert and status values

### Established Patterns
- All DB queries server-side only (`server-only` guard) — form submission handler must be a Server Action or API Route, not a Client Component
- Plain Tailwind CSS — no component library, white backgrounds, subtle borders
- `app/(public)/page.tsx` and `app/(public)/confirmation/page.tsx` are placeholder stubs — ready to be replaced

### Integration Points
- `app/(public)/page.tsx` → teacher form (replace stub)
- `app/(public)/confirmation/page.tsx` → outcome page (replace stub, handles both submitted and auto-denied states)
- New: `lib/email/templates/auto-denial.ts` (or `.html`) — editable email template
- New: API route or Server Action for form submission → writes to `requests`, triggers email if auto-denied

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-teacher-form-and-auto-denial*
*Context gathered: 2026-03-11*
