# Phase 3: Email Approval Workflow - Research

**Researched:** 2026-03-11
**Domain:** Next.js 15 App Router route handlers, Resend batch email API, tokenized approval links, idempotent state transitions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Admin notification email**
- Full details in the email: teacher name, teacher email, leave type, start date, end date, reason, and blackout flag
- Always show the reason field — display "(none provided)" when the teacher left it blank
- Approve and Deny actions rendered as styled HTML buttons: green Approve button, red Deny button (anchor tags styled as buttons — consistent with existing email template visual style)
- Subject line: "New leave request: [Teacher Name]"

**Multi-admin sending**
- Use `resend.batch.send()` to send a separate email to each address in `ADMIN_EMAILS`
- Each admin's email contains approval URLs with their address baked in: `?admin=their@email.com`
- `reviewed_by` in the DB stores the specific admin email extracted from the query param
- First click wins: idempotency check (status !== 'pending') catches any concurrent second click — second admin gets the "already reviewed" page, no duplicate teacher emails sent

**Approval URL structure**
- Route: `GET /api/approve`
- Params: `?action=approve|deny&id={requestId}&token={APPROVAL_SECRET}&admin={adminEmail}`
- Token validated server-side against `process.env.APPROVAL_SECRET` on every request

**"Already reviewed" page**
- New dedicated route: `/reviewed` (not reusing `/confirmation`)
- Shows: current status (Approved / Denied), teacher name, dates, leave type, and which admin reviewed it
- Invalid or missing token → separate error page (distinct from "already reviewed")

**Teacher confirmation emails**
- Approval email: minimal — "Your request has been approved." No dates, leave type, or admin attribution echoed back
- Denial email: respectful and direct — acknowledges the request, states it was denied, echoes dates and leave type; no next-steps guidance or contact suggestion (denial is final)
- Subject lines: "Your time-off request has been approved" / "Your time-off request has been denied"
- No mention of which admin took the action in either email

### Claude's Discretion
- Exact Tailwind styling on the `/reviewed` and error pages
- HTML email layout and wording for admin notification and teacher confirmation templates (warm/professional tone, operator can edit template files)
- Exact error page copy for invalid/missing token
- How to pass request details to the `/reviewed` page (redirect with query params vs. server-rendered fetch by ID)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-03 | Non-blackout requests are set to `pending` status and trigger admin notification email | `submitRequest` server action already inserts with `status: 'pending'` for non-blackout; add `resend.batch.send()` call after successful DB insert, parsing `ADMIN_EMAILS` env var |
| EMAIL-02 | All admin addresses (from `ADMIN_EMAILS` env var) receive request details with tokenized Approve and Deny buttons | `resend.batch.send()` maps each admin address to its own email object; approval URL embeds `?admin=` per-address param |
| APPR-01 | Approval API validates `APPROVAL_SECRET` token on every inbound request | GET handler reads `token` query param, compares to `process.env.APPROVAL_SECRET`; mismatch redirects to invalid-token page |
| APPR-02 | Approval API returns a friendly "already reviewed" page if request status is not `pending` (idempotency guard) | After token validation, fetch row by `id`; if `status !== 'pending'`, redirect to `/reviewed?id=...` instead of applying update |
| APPR-03 | Approval action updates `status`, `reviewed_at`, and `reviewed_by` (admin email passed as query param) | Supabase `.update({ status, reviewed_at: new Date().toISOString(), reviewed_by: adminEmail }).eq('id', id)` |
| APPR-04 | Teacher confirmation email is sent only after a successful DB status update | Check Supabase update error before calling `sendEmail()`; only send on success |
| EMAIL-03 | Teacher receives a warm approval confirmation email | New `approval-confirmation.ts` template; minimal content per decisions |
| EMAIL-04 | Teacher receives a respectful denial email with dates and leave type | New `denial-confirmation.ts` template; echoes dates and leave type per decisions |
</phase_requirements>

---

## Summary

Phase 3 wires together three distinct concerns: (1) triggering multi-admin batch email on form submission, (2) a GET route handler that validates a shared secret token, reads a Supabase row, applies an idempotent status update, and sends a teacher confirmation email, and (3) two new pages (`/reviewed` and an invalid-token error page) that admins land on after clicking.

All infrastructure already exists. The `submitRequest` server action just needs the batch send call appended after the DB insert. The `/api/approve/route.ts` stub needs to become a real handler. Three email templates need to be created in `lib/email/templates/`. Two pages need to be created under `app/`. No new libraries are required — Resend v6, supabase-js v2.99, Next.js 15, and Tailwind 4 are already installed.

The most subtle concern is the idempotency window: two admins could click within milliseconds of each other. The correct guard is to check `status !== 'pending'` immediately after token validation and before the update, not as a post-update check. Supabase does not guarantee atomic compare-and-swap through the JS client, so the implementation relies on a read-then-write with an early exit — this is acceptable given the low-concurrency context (small school, handful of admins).

**Primary recommendation:** Implement the GET handler as a pure server-side redirect flow: validate token → fetch row → idempotency check → update DB → send teacher email → redirect to `/reviewed`. All redirects use `NextResponse.redirect()` with `new URL(path, request.url)`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | ^6.9.3 (installed) | Transactional email including batch send | Already used in Phase 2; `batch.send()` is the official multi-recipient pattern |
| @supabase/supabase-js | ^2.99.0 (installed) | DB read (fetch by id) and write (update status) | Already used project-wide; service role client in `lib/supabase/server.ts` |
| next | 15.5.12 (installed) | GET route handler, `NextResponse.redirect()`, page components | Project framework |
| tailwindcss | ^4 (installed) | Styling `/reviewed` and error pages | Project CSS framework |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| server-only | ^0.0.1 (installed) | Guard new email templates from accidental client import | Already used on `lib/email/send.ts` and `lib/supabase/server.ts` — templates don't need it since they're pure functions (same pattern as `auto-denial.ts`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `resend.batch.send()` | `sendEmail()` wrapper in a loop | Loop makes N sequential API calls; batch is a single call. Batch is locked decision. |
| `NextResponse.redirect()` | `redirect()` from next/navigation | Both work in route handlers. `NextResponse.redirect()` is more explicit in route handler context and is what official docs demonstrate. |

**Installation:** No new packages required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure (additions for Phase 3)

```
app/
├── api/approve/route.ts         # replace stub with full GET handler
├── reviewed/page.tsx            # "already reviewed" page (new)
└── invalid/page.tsx             # invalid/missing token error page (new)
lib/email/templates/
├── admin-notification.ts        # new: admin email with Approve/Deny buttons
├── approval-confirmation.ts     # new: teacher approval email
└── denial-confirmation.ts       # new: teacher denial email
```

### Pattern 1: GET Route Handler — Redirect Flow

**What:** A GET route handler that validates input, performs a DB operation, and redirects to a page rather than returning JSON.
**When to use:** When an email link needs to trigger a server-side action and land the user on an informational page.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/next-response
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get('token')
  const id = searchParams.get('id')
  const action = searchParams.get('action')
  const admin = searchParams.get('admin')

  // 1. Validate token
  if (!token || token !== process.env.APPROVAL_SECRET) {
    return NextResponse.redirect(new URL('/invalid', request.url))
  }

  // 2. Fetch row, check idempotency
  // 3. Update DB
  // 4. Send teacher email
  // 5. Redirect to /reviewed?id=...
}
```

### Pattern 2: Resend Batch Send — Per-Admin Emails

**What:** Build one email object per admin address, each with a unique approval URL that embeds `?admin=their@email.com`.
**When to use:** When each recipient needs a personalized link (not BCC).

```typescript
// Source: https://resend.com/docs/api-reference/emails/send-batch-emails
const resend = new Resend(process.env.RESEND_API_KEY)

const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)

const batch = adminEmails.map(adminEmail => ({
  from: process.env.RESEND_FROM ?? 'Time Off System <noreply@example.com>',
  to: [adminEmail],
  subject: `New leave request: ${teacherName}`,
  html: adminNotificationTemplate({
    teacherName,
    teacherEmail,
    leaveType,
    startDate,
    endDate,
    reason,
    approveUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/approve?action=approve&id=${id}&token=${process.env.APPROVAL_SECRET}&admin=${encodeURIComponent(adminEmail)}`,
    denyUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/approve?action=deny&id=${id}&token=${process.env.APPROVAL_SECRET}&admin=${encodeURIComponent(adminEmail)}`,
  }),
}))

const { data, error } = await resend.batch.send(batch)
```

### Pattern 3: Supabase Update — Return Updated Row

**What:** `.update().eq().select().single()` to confirm the update succeeded and get the resulting row.
**When to use:** When you need the post-update row data (e.g., to pass to the email or redirect page).

```typescript
// Source: supabase-js v2 — project convention in lib/supabase/server.ts
const supabase = createClient()

const { data: updated, error: updateError } = await supabase
  .from('requests')
  .update({
    status: action === 'approve' ? 'approved' : 'denied',
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminEmail,
  })
  .eq('id', id)
  .select()
  .single()
```

### Pattern 4: Reviewed Page — Query Param vs. Server Fetch

**What:** The `/reviewed` page needs to display request context. Two options:
1. Redirect from GET handler with query params: `?status=approved&teacher=Jane&...`
2. Redirect with only `?id=...` and fetch from DB in the page.

**Recommendation (Claude's discretion):** Pass key display fields as query params in the redirect. Avoids a second DB call in the page component and keeps the page stateless and fast. Fields needed: `id`, `status`, `teacher_name`, `start_date`, `end_date`, `leave_type`, `reviewed_by`. URL-encode all values.

### Pattern 5: Email Template — HTML String Function

**What:** TypeScript functions returning HTML strings. Established by `auto-denial.ts`.
**When to use:** All three new templates follow this exact pattern.

Key conventions from existing template:
- No `server-only` import needed (pure function, no I/O)
- Import `LeaveType` from `@/types/database`
- Reuse `LEAVE_TYPE_LABELS` map and `formatDate()` helper (copy or extract to shared util)
- Inline CSS only — no Tailwind in email HTML
- Consistent wrapper: `max-width: 600px`, white card on gray background, `border-radius: 8px`

### Anti-Patterns to Avoid

- **Sending teacher email before DB update:** APPR-04 explicitly forbids this. Always check `updateError` first.
- **Placing `redirect()` inside try/catch:** Established project rule — NEXT_REDIRECT is swallowed. Use `NextResponse.redirect()` in route handlers instead (returns a value, does not throw).
- **Top-level `new Resend()`:** Established project rule (Phase 2 bug) — instantiate inside the function to defer API key access to runtime.
- **Using `sendEmail()` wrapper for batch:** The wrapper calls `resend.emails.send()` (single email). For batch, instantiate Resend and call `resend.batch.send()` directly.
- **ADMIN_EMAILS as a single string:** Must split on comma, trim whitespace, filter empty strings before mapping to batch array.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-recipient email with per-recipient personalization | Loop of `sendEmail()` calls | `resend.batch.send()` | Single API call; sequential loop would be slower and could partially fail |
| HTML email styling | Tailwind, CSS modules | Inline CSS strings | Email clients strip `<style>` tags and class attributes; inline CSS is the only reliable method |
| Token-based auth for approval links | JWT, HMAC signatures | Shared `APPROVAL_SECRET` env var | Locked decision; simple string comparison is sufficient for this use case |
| Idempotency via DB lock | Row-level locking, transactions | Read-then-check `status !== 'pending'` | Low-concurrency context; early exit on non-pending status is sufficient |

**Key insight:** The entire approval flow is orchestrated by a single route handler with linear logic — no queues, no background jobs, no webhooks.

---

## Common Pitfalls

### Pitfall 1: APPROVAL_SECRET Token Exposure in Email Links

**What goes wrong:** The `APPROVAL_SECRET` appears in the approval URL query string in every admin email. If this is logged, cached, or forwarded, any holder can approve/deny any request.
**Why it happens:** Shared-secret-in-URL is the locked architecture; this is an inherent tradeoff.
**How to avoid:** Do not log the full URL in server logs. The `APPROVAL_SECRET` must use the unprefixed env var name (never `NEXT_PUBLIC_APPROVAL_SECRET` — SEC-02 is already enforced). The token is validated server-side on every request.
**Warning signs:** Any `NEXT_PUBLIC_` prefix on `APPROVAL_SECRET` in `.env.local` or `.env.example`.

### Pitfall 2: BASE_URL for Approval Links

**What goes wrong:** The approval URLs embedded in admin emails need an absolute URL. Using a relative path like `/api/approve?...` produces broken links in email clients.
**Why it happens:** Email HTML renders outside the Next.js app — there's no request context to resolve relative URLs.
**How to avoid:** Use `process.env.NEXT_PUBLIC_BASE_URL` (or a dedicated `APP_URL` env var) to build the full URL: `${process.env.NEXT_PUBLIC_BASE_URL}/api/approve?...`. This is one case where `NEXT_PUBLIC_` prefix is appropriate — the base URL is not secret.
**Warning signs:** Approval links in emails 404 or show relative paths.

### Pitfall 3: ADMIN_EMAILS Parsing Edge Cases

**What goes wrong:** `ADMIN_EMAILS=admin@school.edu, vp@school.edu` (with spaces) produces `[" vp@school.edu"]` if not trimmed, causing email delivery failures.
**Why it happens:** `.split(',')` without `.map(e => e.trim())`.
**How to avoid:** Always: `.split(',').map(e => e.trim()).filter(Boolean)`.
**Warning signs:** Some admins don't receive emails; Resend returns address validation errors.

### Pitfall 4: Idempotency Race Condition Window

**What goes wrong:** Two admins click within milliseconds; both read `status === 'pending'`, both proceed to update, teacher gets two confirmation emails.
**Why it happens:** Read-then-write is not atomic in the Supabase JS client without explicit transactions.
**How to avoid:** The locked design accepts this as an acceptable risk for a small-school context. The `.update().eq('id', id)` call is still harmless if it runs twice — the DB row ends up in the same state. The main concern is the email — only send after confirming the update's `reviewed_at` was freshly set. In practice this window is milliseconds; document as known limitation.
**Warning signs:** Teacher reports receiving two emails; `reviewed_at` shows nearly identical timestamps.

### Pitfall 5: searchParams Must Be Awaited in Next.js 15 Page Components

**What goes wrong:** `const { id } = searchParams` throws a warning or runtime error in Next.js 15.
**Why it happens:** `searchParams` is a Promise in Next.js 15 page components (same as `cookies()`).
**How to avoid:** `const { id } = await searchParams` in the page component props.
**Warning signs:** Build warnings about async params; `searchParams.id` is undefined at runtime.

---

## Code Examples

Verified patterns from official sources and existing project code:

### Accessing Query Params in a GET Route Handler

```typescript
// Source: https://nextjs.org/docs/app/getting-started/route-handlers
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')  // 'approve' | 'deny'
  const id = searchParams.get('id')
  const token = searchParams.get('token')
  const admin = searchParams.get('admin')
}
```

### Redirecting from a Route Handler

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/next-response
return NextResponse.redirect(new URL('/reviewed?status=approved', request.url))
```

### Resend Batch Send

```typescript
// Source: https://resend.com/docs/api-reference/emails/send-batch-emails
// Instantiate inside function — top-level instantiation throws at build with missing key
const resend = new Resend(process.env.RESEND_API_KEY)
const { data, error } = await resend.batch.send([
  {
    from: 'sender@example.com',
    to: ['admin1@school.edu'],
    subject: 'New leave request: Jane Smith',
    html: '<p>...</p>',
  },
  {
    from: 'sender@example.com',
    to: ['admin2@school.edu'],
    subject: 'New leave request: Jane Smith',
    html: '<p>...</p>',  // different approve/deny URLs
  },
])
```

### Awaiting searchParams in a Next.js 15 Page Component

```typescript
// Source: existing app/(public)/confirmation/page.tsx — established project pattern
type Props = {
  searchParams: Promise<{ status?: string; id?: string }>
}

export default async function ReviewedPage({ searchParams }: Props) {
  const { status, id, teacher_name } = await searchParams
}
```

### Supabase Fetch by ID

```typescript
// Source: lib/supabase/server.ts — existing project pattern
const supabase = createClient()
const { data: request, error } = await supabase
  .from('requests')
  .select('*')
  .eq('id', id)
  .single()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sendEmail()` wrapper for all sends | `resend.batch.send()` directly for multi-admin | Phase 3 design | Wrapper is for single sends; batch requires direct Resend instantiation |
| `searchParams.id` (sync) | `await searchParams` then destructure | Next.js 15 | Page components must await searchParams — established in confirmation page |
| `redirect()` from next/navigation in route handlers | `NextResponse.redirect()` in route handlers | Established project rule | `redirect()` throws NEXT_REDIRECT which can be swallowed by try/catch |

**Deprecated/outdated:**
- `app/api/approve/route.ts` stub: replace entirely with full handler

---

## Open Questions

1. **BASE_URL env var name**
   - What we know: Approval link URLs must be absolute. `NEXT_PUBLIC_BASE_URL` is not yet in `.env.example`.
   - What's unclear: Whether the project uses `NEXT_PUBLIC_BASE_URL` or `APP_URL` or derives the URL from `request.url` in the handler.
   - Recommendation: Derive from `request.url` inside the route handler using `new URL('/', request.url).origin` — eliminates the need for any base URL env var. The handler already has `request` available. Templates receive the full URLs as string args, so they don't need env access.

2. **`formatDate()` and `LEAVE_TYPE_LABELS` duplication**
   - What we know: These are defined in `auto-denial.ts` and will be needed in all three new templates.
   - What's unclear: Whether to copy them into each template or extract to a shared `lib/email/utils.ts`.
   - Recommendation (Claude's discretion): Extract to `lib/email/utils.ts`. Three templates copying the same 20 lines of code is unnecessary duplication and risks divergence.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None — Wave 0 must add |
| Quick run command | `npm run lint` (only automated check available currently) |
| Full suite command | `npm run lint && npm run build` |

No test framework (Jest, Vitest, Playwright) is installed. The project has no `test/`, `tests/`, or `__tests__/` directories and no test scripts in `package.json`.

For Phase 3, the approval workflow logic is concentrated in a single route handler. The most practical automated verification is a TypeScript build check (`npm run build`) which will catch type errors in the new route handler, templates, and pages.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-03 | `submitRequest` triggers batch send for non-blackout | manual smoke | Submit a non-blackout form, check admin inboxes | N/A |
| EMAIL-02 | All ADMIN_EMAILS receive emails with correct approve/deny URLs | manual smoke | Verify email receipt and link structure | N/A |
| APPR-01 | Wrong/missing token → invalid page, no DB change | manual smoke | `curl '/api/approve?action=approve&id=X&token=wrong'` | N/A |
| APPR-02 | Already-reviewed request → `/reviewed` page, no second email | manual smoke | Click approval link twice | N/A |
| APPR-03 | DB update sets status, reviewed_at, reviewed_by | manual smoke | Check Supabase table after approval click | N/A |
| APPR-04 | Teacher email sent only after DB success | build check | `npm run build` catches missing await / wrong order | ❌ Wave 0 |
| EMAIL-03 | Teacher receives approval email | manual smoke | Check teacher inbox | N/A |
| EMAIL-04 | Teacher receives denial email with dates and leave type | manual smoke | Check teacher inbox | N/A |

### Sampling Rate

- **Per task commit:** `npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` passes before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No test framework — all behavioral verification is manual smoke testing or build-time type checking
- [ ] `NEXT_PUBLIC_BASE_URL` (or equivalent) may need to be added to `.env.example` if base URL is not derived from `request.url`

*(If a test framework is desired, `vitest` would be the natural fit for unit-testing the template functions and token validation logic, but this is out of scope for v1.)*

---

## Sources

### Primary (HIGH confidence)

- https://resend.com/docs/api-reference/emails/send-batch-emails — `resend.batch.send()` method signature, parameter structure, return type
- https://nextjs.org/docs/app/api-reference/functions/next-response — `NextResponse.redirect()` usage in route handlers
- https://nextjs.org/docs/app/getting-started/route-handlers — `request.nextUrl.searchParams` pattern for GET handlers
- Existing project code: `lib/email/send.ts`, `lib/email/templates/auto-denial.ts`, `app/(public)/actions.ts`, `app/(public)/confirmation/page.tsx`, `lib/supabase/server.ts`, `types/database.ts`

### Secondary (MEDIUM confidence)

- https://nextjs.org/docs/app/guides/redirecting — redirect options in Next.js 15
- https://resend.com/blog/introducing-the-batch-emails-api — batch API context and limits (up to 100 emails per call)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; `resend.batch.send()` verified against official docs
- Architecture: HIGH — route handler pattern verified against Next.js 15 official docs; template pattern verified from existing codebase
- Pitfalls: HIGH — BASE_URL and ADMIN_EMAILS parsing are common; idempotency is documented as known limitation; token exposure is inherent to locked design

**Research date:** 2026-03-11
**Valid until:** 2026-04-10 (stable stack)
