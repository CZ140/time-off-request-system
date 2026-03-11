# Phase 2: Teacher Form and Auto-Denial - Research

**Researched:** 2026-03-11
**Domain:** Next.js 15 Server Actions, React 19 form hooks, Supabase insert, Resend HTML email, Tailwind 4 form styling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Form Layout**
- Centered white card on a light gray page background
- No page header or school name above the card — card title ("Request Time Off") is sufficient
- Single-column layout, all fields stacked vertically
- No component library — plain Tailwind classes throughout

**Form Fields and Controls**
- Leave Type: radio buttons (all 7 options visible, not a dropdown)
- Date fields: native HTML `<input type="date">` — no third-party date picker
- Reason field: optional, labeled clearly as such
- Field order: Full Name → Work Email → Start Date → End Date → Leave Type → Blackout Period → Reason → Submit

**Blackout Flag Field**
- Presented as a Yes/No radio group with explanation text: "Blackout dates are school periods when leave is not permitted (e.g., state testing weeks, spring break)."
- Required — teacher must explicitly select Yes or No before submitting (no default)
- Positioned after Leave Type, before Reason
- When "Yes" is selected: show an inline amber/yellow warning — "Your request will be automatically denied. You'll receive a confirmation email."

**Confirmation & Denial Pages**
- Both use the same `/confirmation` route — page content differs based on outcome
- Successful submission page: minimal — checkmark icon, brief message ("Your request has been received"), note that they'll receive a response via email
- Auto-denial page: warm and empathetic — explains dates fall on a blackout period, confirms a confirmation email is on the way
- Both pages include a "Submit another request" link back to the form

**Email Templates**
- Templates live in `lib/email/templates/` as separate files — editable independently of logic code
- Tone: warm and friendly
- Auto-denial email content: addresses teacher by name, echoes leave type and date range, explains the blackout reason gently
- No "next steps" or contact suggestion — the denial is final and policy-based
- Sender: `RESEND_FROM` env var (operator-configured) — no hardcoded school name in template

**Validation Behavior**
- Inline errors shown on submit attempt (not on blur)
- Client-side: required fields, end date not before start date, start date not in the past
- Server-side: same rules validated in the Server Action/API route before DB write

**Existing Reusable Assets (Phase 1 output)**
- `lib/supabase/server.ts` → `createClient()` — service role client, typed with `Database`
- `lib/email/send.ts` → `sendEmail({ to, subject, html })` — Resend wrapper, reads `RESEND_FROM`
- `types/database.ts` → `LeaveType`, `RequestStatus`, `Database` — typed inserts

**Established Patterns**
- All DB queries server-side only (`server-only` guard) — form submission handler must be a Server Action, not a Client Component
- Plain Tailwind CSS — no component library, white backgrounds, subtle borders
- `app/(public)/page.tsx` and `app/(public)/confirmation/page.tsx` are placeholder stubs ready to replace

### Claude's Discretion

- Exact Tailwind classes, spacing, and typography
- Loading/disabled state design for the Submit button
- Exact wording of email body (warm and friendly, operator can edit template file)
- Error message copy for each validation rule
- How to pass outcome (submitted vs auto-denied) to the `/confirmation` page (search params, redirect with status, etc.)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FORM-01 | Teacher can submit a request with full name, work email, start date, end date, leave type (7 options), blackout flag (yes/no), and optional reason | `formData.get()` from Server Action; all 7 `LeaveType` values from `types/database.ts` |
| FORM-02 | Form displays inline validation errors for all required fields before submission | `useActionState` returns error state; errors rendered conditionally per field |
| FORM-03 | Submit button is disabled on click to prevent duplicate submissions | `pending` boolean from `useActionState` third return value; `disabled={pending}` on button |
| FORM-04 | Form rejects end dates before start date and start dates in the past | Date comparison in both server action (authoritative) and optional HTML `min` attr for UX; `new Date()` comparison server-side |
| FORM-05 | Teacher is redirected to a confirmation page after successful submission | `redirect('/confirmation?status=submitted')` from `next/navigation` called outside try/catch in Server Action |
| REQ-01 | All submissions are saved to the `requests` table in Supabase | `createClient().from('requests').insert({...})` typed with `Database['public']['Tables']['requests']['Insert']` |
| REQ-02 | Blackout-flagged requests are immediately set to `auto_denied` status — no admin email sent | `status: isBlackout ? 'auto_denied' : 'pending'` in the insert payload; conditional email logic |
| EMAIL-01 | Auto-denied teacher receives email explaining their dates fall on a blackout period | `sendEmail()` called only when `isBlackout === true`; template from `lib/email/templates/auto-denial.ts` |
</phase_requirements>

---

## Summary

Phase 2 builds the teacher-facing submission flow: a public HTML form, a server action that writes to Supabase, conditional auto-denial logic, a Resend email for blackout cases, and a shared confirmation page that adapts its content based on a URL search parameter.

The dominant technical decisions are already locked. The form is a Client Component (needed for `useActionState` and reactive UI), backed by a separate `'use server'` file for the action. The action validates server-side, inserts into the `requests` table, and either redirects to `/confirmation?status=submitted` or sends a Resend email and redirects to `/confirmation?status=auto_denied`. The confirmation page reads `searchParams` (awaited, since Next.js 15 makes it a Promise) and renders either the success or denial content.

The key technical nuance is the `useActionState` hook (React 19): it must wrap the form in a Client Component, the server action signature must accept `(prevState, formData)`, and the `pending` third return value replaces any need for a separate `useFormStatus` in this pattern. Date validation server-side uses `new Date()` comparison against today (in UTC, consistent with how Supabase stores `DATE` columns as ISO strings). The `redirect()` call from `next/navigation` must be placed outside any `try/catch` block because it internally throws a `NEXT_REDIRECT` error.

**Primary recommendation:** Use a dedicated `app/(public)/actions.ts` file with `'use server'` at the top for the form submission action. The form component in `page.tsx` is a Client Component using `useActionState`. Outcome passes to `/confirmation` via `?status=submitted` or `?status=auto_denied` search param.

---

## Standard Stack

### Core (all installed in Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.12 | App Router, Server Actions, `redirect()` | User-confirmed, installed |
| react | 19.1.0 | `useActionState`, `useFormStatus` | Installed; v19 required for `useActionState` |
| @supabase/supabase-js | ^2.99.0 | DB insert to `requests` table | Installed; typed via `Database` generic |
| resend | ^6.9.3 | Send auto-denial email HTML | Installed; `sendEmail()` wrapper already in `lib/email/send.ts` |
| tailwindcss | ^4 | Form styling, card layout, error states | Installed; Tailwind v4 with `@import "tailwindcss"` in globals.css |
| server-only | ^0.0.1 | Prevent `lib/` imports in client bundle | Installed on all lib files |

### No New Dependencies Needed

Phase 2 requires no new npm packages. All required libraries are present from Phase 1. Zod is not installed and is not needed — server-side validation is straightforward enough to implement with native comparisons and explicit checks.

**If zod is desired for cleaner validation:** `npm install zod` — but this is Claude's discretion and not required.

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
app/
└── (public)/
    ├── page.tsx                    # REPLACE stub — Client Component, teacher form
    ├── confirmation/
    │   └── page.tsx                # REPLACE stub — Server Component, reads searchParams
    └── actions.ts                  # NEW — 'use server' form submission action
lib/
└── email/
    └── templates/
        └── auto-denial.ts          # NEW — HTML email template function
```

All other Phase 1 files remain unchanged.

### Pattern 1: Server Action in a Dedicated File

**What:** All server-only mutation logic lives in `app/(public)/actions.ts` with `'use server'` at the top of the file. The Client Component imports the action.

**When to use:** Any time a Client Component needs to call server-side code. Separating action from component keeps the Client Component bundle clean.

**Example:**

```typescript
// app/(public)/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { autoDenialTemplate } from '@/lib/email/templates/auto-denial'
import type { LeaveType } from '@/types/database'

export type FormState = {
  errors?: {
    teacher_name?: string[]
    teacher_email?: string[]
    start_date?: string[]
    end_date?: string[]
    leave_type?: string[]
    is_blackout?: string[]
  }
  message?: string
}

export async function submitRequest(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // 1. Extract fields
  const teacher_name = formData.get('teacher_name') as string
  const teacher_email = formData.get('teacher_email') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const leave_type = formData.get('leave_type') as LeaveType
  const is_blackout = formData.get('is_blackout') === 'true'
  const reason = (formData.get('reason') as string) || null

  // 2. Server-side validation
  const errors: FormState['errors'] = {}
  if (!teacher_name?.trim()) errors.teacher_name = ['Full name is required.']
  if (!teacher_email?.trim()) errors.teacher_email = ['Work email is required.']
  if (!start_date) {
    errors.start_date = ['Start date is required.']
  } else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(start_date) < today) {
      errors.start_date = ['Start date cannot be in the past.']
    }
  }
  if (!end_date) {
    errors.end_date = ['End date is required.']
  } else if (start_date && new Date(end_date) < new Date(start_date)) {
    errors.end_date = ['End date cannot be before start date.']
  }
  if (!leave_type) errors.leave_type = ['Please select a leave type.']
  if (formData.get('is_blackout') === null) {
    errors.is_blackout = ['Please indicate if this falls on a blackout date.']
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  // 3. Determine status
  const status = is_blackout ? 'auto_denied' : 'pending'

  // 4. Insert into Supabase
  const supabase = createClient()
  const { error: dbError } = await supabase.from('requests').insert({
    teacher_name,
    teacher_email,
    start_date,
    end_date,
    leave_type,
    is_blackout,
    reason,
    status,
  })

  if (dbError) {
    return { message: 'Something went wrong. Please try again.' }
  }

  // 5. Send auto-denial email if needed
  if (is_blackout) {
    await sendEmail({
      to: teacher_email,
      subject: 'Your time-off request — blackout period',
      html: autoDenialTemplate({
        teacherName: teacher_name,
        leaveType: leave_type,
        startDate: start_date,
        endDate: end_date,
      }),
    })
  }

  // 6. Redirect — must be outside try/catch; throws NEXT_REDIRECT internally
  redirect(`/confirmation?status=${status}`)
}
```

**Critical:** `redirect()` throws a `NEXT_REDIRECT` error internally. Never wrap it in a `try/catch`. It must be the last call in the happy path.

### Pattern 2: Client Component Form with useActionState

**What:** The form page is a Client Component (`'use client'`) that uses `useActionState` to manage form state and show inline errors. The `pending` third return value disables the submit button automatically.

**When to use:** Any form that needs to display server-returned validation errors without a full page reload.

**Example:**

```typescript
// app/(public)/page.tsx
'use client'

import { useActionState } from 'react'
import { submitRequest, type FormState } from './actions'

const initialState: FormState = {}

export default function TeacherFormPage() {
  const [state, formAction, pending] = useActionState(submitRequest, initialState)

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Request Time Off</h1>
        <form action={formAction} noValidate>
          {/* Full Name */}
          <div className="mb-4">
            <label htmlFor="teacher_name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="teacher_name"
              name="teacher_name"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-describedby={state.errors?.teacher_name ? 'teacher_name-error' : undefined}
            />
            {state.errors?.teacher_name && (
              <p id="teacher_name-error" className="mt-1 text-sm text-red-600">
                {state.errors.teacher_name[0]}
              </p>
            )}
          </div>

          {/* ... other fields ... */}

          {state.message && (
            <p className="mb-4 text-sm text-red-600">{state.message}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

**Key points:**
- `useActionState` is imported from `'react'` (React 19), not from `'react-dom'`
- The action signature `(prevState, formData)` is required when using `useActionState`
- `pending` from `useActionState` replaces any need for a separate `useFormStatus` component
- `noValidate` on the form disables browser native validation UI (we show inline errors instead)
- `disabled={pending}` on the submit button satisfies FORM-03

### Pattern 3: Confirmation Page with Awaited searchParams

**What:** The confirmation page is a Server Component that reads `searchParams` (a Promise in Next.js 15) and renders different content based on the `status` value.

**When to use:** Any page that needs to conditionally render content based on URL query parameters.

**Example:**

```typescript
// app/(public)/confirmation/page.tsx
import Link from 'next/link'

type Props = {
  searchParams: Promise<{ status?: string }>
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const { status } = await searchParams

  const isAutoDenied = status === 'auto_denied'

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-lg p-8 text-center">
        {isAutoDenied ? (
          <>
            <div className="text-amber-500 text-4xl mb-4">⚠</div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Request Not Approved</h1>
            <p className="text-gray-600 mb-2">
              Your requested dates fall on a blackout period when leave is not permitted.
            </p>
            <p className="text-gray-600 mb-6">
              A confirmation email has been sent to you explaining the reason.
            </p>
          </>
        ) : (
          <>
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Request Received</h1>
            <p className="text-gray-600 mb-6">
              Your request has been received. You'll receive a response via email once it has been reviewed.
            </p>
          </>
        )}
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Submit another request
        </Link>
      </div>
    </main>
  )
}
```

**Critical:** `searchParams` is a `Promise` in Next.js 15 — must `await` it. Using it synchronously emits a deprecation warning and will break in Next.js 16.

### Pattern 4: HTML Email Template Function

**What:** A TypeScript function that returns a raw HTML string. Lives in `lib/email/templates/` as a separate file so the operator can edit copy without touching route logic.

**When to use:** Producing the `html` argument for `sendEmail()`.

**Example:**

```typescript
// lib/email/templates/auto-denial.ts
// Source: Resend docs — html parameter accepts any valid HTML string

import type { LeaveType } from '@/types/database'

interface AutoDenialTemplateArgs {
  teacherName: string
  leaveType: LeaveType
  startDate: string   // ISO date string, e.g. "2026-04-15"
  endDate: string
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  vacation: 'Vacation',
  bereavement: 'Bereavement Leave',
  jury_duty: 'Jury Duty',
  professional_development: 'Professional Development',
  maternity_paternity: 'Maternity / Paternity Leave',
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function autoDenialTemplate({
  teacherName,
  leaveType,
  startDate,
  endDate,
}: AutoDenialTemplateArgs): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;color:#374151;max-width:600px;margin:0 auto;padding:32px 16px;line-height:1.6">
  <h2 style="color:#111827;font-size:20px;margin-bottom:16px">Hi ${teacherName},</h2>
  <p>Thank you for submitting your time-off request. Unfortunately, we're unable to approve this request because it falls on a blackout period — a school date when leave is not permitted.</p>
  <table style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;width:100%;margin:16px 0">
    <tr><td style="padding:4px 0;color:#6b7280;font-size:14px">Leave type</td><td style="padding:4px 0;font-size:14px">${LEAVE_TYPE_LABELS[leaveType]}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;font-size:14px">Start date</td><td style="padding:4px 0;font-size:14px">${formatDate(startDate)}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280;font-size:14px">End date</td><td style="padding:4px 0;font-size:14px">${formatDate(endDate)}</td></tr>
  </table>
  <p>Blackout periods are set school-wide and cannot be overridden on a case-by-case basis. We appreciate your understanding.</p>
  <p style="margin-top:24px">Warm regards,<br>School Administration</p>
</body>
</html>`
}
```

**Note:** `formatDate` appends `T00:00:00` before parsing to prevent UTC offset from shifting the displayed date by one day (a common gotcha with `DATE` columns from Supabase).

### Pattern 5: Supabase Insert

**What:** Typed insert into `requests` table using the Phase 1 `createClient()` factory.

**When to use:** Inside the server action, after validation passes.

**Example:**

```typescript
// Inside app/(public)/actions.ts (server action)
// Source: @supabase/supabase-js typed insert pattern
const supabase = createClient()
const { error: dbError } = await supabase.from('requests').insert({
  teacher_name,
  teacher_email,
  start_date,   // ISO date string, e.g. "2026-04-15"
  end_date,
  leave_type,   // typed as LeaveType union
  is_blackout,
  reason,       // null if optional field left empty
  status,       // 'pending' | 'auto_denied'
})
```

TypeScript will enforce that `leave_type` matches the `LeaveType` union and `status` matches `RequestStatus`. No additional casting needed.

### Anti-Patterns to Avoid

- **Wrapping `redirect()` in try/catch:** `redirect()` throws `NEXT_REDIRECT` internally. If caught, the redirect silently fails and the user stays on the form page.
- **Reading `searchParams` synchronously in Next.js 15:** `searchParams` is now a `Promise`. Must `await searchParams` in async Server Components.
- **Placing `'use server'` inside a Client Component function:** Server Actions defined inside Client Components cannot use closures over client state. Keep the action in a separate file.
- **Calling `useActionState` in a Server Component:** `useActionState` requires `'use client'`. The form page must be a Client Component.
- **Date comparison without accounting for timezone offset:** `new Date('2026-04-15')` in Node.js is treated as UTC midnight. Compare against `new Date(startDate + 'T00:00:00')` (local) or compare against `new Date().toISOString().split('T')[0]` consistently.
- **Using `useFormStatus` instead of the `pending` from `useActionState`:** In this pattern, `useActionState` already provides `pending` as its third return value. A separate `useFormStatus`-based submit button component is unnecessary overhead.
- **Inline DB insert in Client Component via fetch:** All DB writes must stay in server-side code. The `server-only` guard on `lib/supabase/server.ts` will cause a build error if attempted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form pending state | Manual `useState(false)` + setting to true on submit | `pending` from `useActionState` | Race conditions, no automatic reset on error, doesn't handle network failures |
| Date validation | Custom regex or string slicing | Native `Date` comparison in server action | ISO date strings from `<input type="date">` are reliably parseable with `new Date()` |
| Email HTML layout | Tables from scratch every time | Template function in `lib/email/templates/auto-denial.ts` | Centralizes editable copy; email clients require inline CSS which makes ad-hoc HTML error-prone |
| Duplicate submit prevention | `useState` disable flag | `disabled={pending}` via `useActionState` | `useActionState`'s `pending` is tied to the actual action lifecycle, not just the click event |

---

## Common Pitfalls

### Pitfall 1: `redirect()` Inside try/catch

**What goes wrong:** The `redirect()` call is placed inside a `try { ... } catch { ... }` block. `redirect()` throws a special `NEXT_REDIRECT` error internally. The `catch` block intercepts it, the redirect never fires, and the user sees no response.

**Why it happens:** Developers naturally wrap async DB/email code in try/catch. `redirect()` looks like it belongs after a successful await.

**How to avoid:** Complete all DB/email work inside a try/catch. Store the outcome. Call `redirect()` after the try/catch block ends.

**Warning signs:** Form submits successfully (no errors returned), but the page does not navigate away.

### Pitfall 2: `searchParams` Not Awaited in Next.js 15

**What goes wrong:** `const { status } = searchParams` in the confirmation page — synchronous access. Works in development with a deprecation warning; throws or returns `undefined` in production builds.

**Why it happens:** `searchParams` was synchronous in Next.js 14. Next.js 15 made it a Promise. The type signature has changed.

**How to avoid:** Always write `const { status } = await searchParams` in async Server Components. For Client Components, use `use(searchParams)` from React.

**Warning signs:** Confirmation page renders the wrong variant (always shows success or always shows denial regardless of `?status=`).

### Pitfall 3: Date Off-By-One Due to UTC Timezone Offset

**What goes wrong:** `new Date('2026-04-15')` creates a Date at UTC midnight. In timezones west of UTC (e.g., US), this resolves to the previous day at local midnight. Comparing against `new Date()` (local) can cause start-date-in-past false positives for today's date.

**Why it happens:** ISO date strings without time component are parsed as UTC by JavaScript's `Date` constructor.

**How to avoid:** Append `T00:00:00` when constructing dates from the form's date string: `new Date(startDate + 'T00:00:00')`. Compare against today's date with time zeroed out: `today.setHours(0, 0, 0, 0)`.

**Warning signs:** Teachers report that selecting today's date shows "start date in the past" error.

### Pitfall 4: Form Inputs Resetting After Failed Submission

**What goes wrong:** Server action returns validation errors, but the form fields clear their values on re-render because they use uncontrolled inputs with no `defaultValue`.

**Why it happens:** React Server Actions reset uncontrolled form inputs on re-render after an action completes. This is documented Next.js 15 behavior.

**How to avoid:** Return field values alongside errors from the server action and set them as `defaultValue` on each input. Alternatively, manage controlled inputs with `useState` (adds complexity). The simplest pattern is returning the raw form data on error:

```typescript
// In server action, on validation failure:
return {
  errors,
  values: { teacher_name, teacher_email, start_date, end_date, leave_type, reason }
}
```

Then in the form: `defaultValue={state.values?.teacher_name ?? ''}`.

**Warning signs:** All form fields clear when a validation error is returned, frustrating teachers who filled in valid data alongside one invalid field.

### Pitfall 5: `is_blackout` Radio Value Type Mismatch

**What goes wrong:** Radio buttons for blackout flag use values `"true"` and `"false"` (strings). `formData.get('is_blackout')` returns a string. Comparing `=== true` (boolean) always fails.

**Why it happens:** All FormData values are strings. Implicit boolean coercion is unreliable.

**How to avoid:** Explicitly compare: `const is_blackout = formData.get('is_blackout') === 'true'`. Also check for the unselected state: `formData.get('is_blackout') === null` means the teacher didn't pick either radio button.

**Warning signs:** `is_blackout` is always `false` regardless of what the teacher selected.

### Pitfall 6: Email Sends Before DB Write Completes

**What goes wrong:** `sendEmail()` is called in parallel with (or before) the Supabase insert. If the insert fails, the teacher receives a denial email for a request that was never saved.

**Why it happens:** Developer uses `Promise.all([insert, sendEmail()])` to parallelize for speed.

**How to avoid:** Always `await` the DB insert and check for errors before calling `sendEmail()`. The sequence must be: validate → insert → check insert error → (if success and is_blackout) send email → redirect.

---

## Code Examples

Verified patterns from official sources:

### useActionState — Full Signature

```typescript
// Source: https://react.dev/reference/react/useActionState
// Source: https://nextjs.org/docs/app/guides/forms
'use client'

import { useActionState } from 'react'
import { submitRequest, type FormState } from './actions'

const initialState: FormState = {}

export default function TeacherFormPage() {
  const [state, formAction, pending] = useActionState(submitRequest, initialState)
  // state: current FormState (errors, message, values)
  // formAction: pass as form's action prop
  // pending: boolean, true while server action is executing
  return <form action={formAction}>...</form>
}
```

### Server Action Signature with useActionState

```typescript
// Source: https://nextjs.org/docs/app/guides/forms#validation-errors
// When used with useActionState, the first parameter is prevState (not formData)
export async function submitRequest(
  prevState: FormState,    // REQUIRED first param when used with useActionState
  formData: FormData
): Promise<FormState> {
  // ...
}
```

### searchParams in Next.js 15 Server Component Page

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { status } = await searchParams   // must await — it's a Promise in Next.js 15
  // ...
}
```

### redirect() Outside try/catch

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/redirect
// redirect() throws NEXT_REDIRECT — must be outside try/catch
'use server'
import { redirect } from 'next/navigation'

export async function submitRequest(prevState: FormState, formData: FormData) {
  let outcome: 'pending' | 'auto_denied' | null = null
  try {
    // ... validation, insert, email ...
    outcome = isBlackout ? 'auto_denied' : 'pending'
  } catch {
    return { message: 'Something went wrong. Please try again.' }
  }
  // Redirect is outside try/catch — throws NEXT_REDIRECT safely
  redirect(`/confirmation?status=${outcome}`)
}
```

### Supabase Typed Insert

```typescript
// Source: @supabase/supabase-js typed client pattern; types from types/database.ts
const { error } = await supabase.from('requests').insert({
  teacher_name: 'Jane Smith',
  teacher_email: 'jane@school.edu',
  start_date: '2026-04-15',       // Supabase DATE column accepts ISO date strings
  end_date: '2026-04-16',
  leave_type: 'sick',             // typed as LeaveType — TypeScript enforces valid values
  is_blackout: false,
  reason: null,                   // nullable column
  status: 'pending',              // typed as RequestStatus
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormState` from `react-dom` | `useActionState` from `react` | React 19 / Next.js 15 | Import source changed; `useFormState` is deprecated and removed in React 19 |
| `searchParams` synchronous prop | `searchParams` is a Promise — must `await` | Next.js 15.0 | All confirmation-style pages receiving query params must be async |
| `params` synchronous prop | `params` is a Promise — must `await` | Next.js 15.0 | Same pattern; affects dynamic route pages in Phase 3+ |
| `useFormStatus` for pending state | `pending` from `useActionState` (3rd return value) | React 19 | Simpler — no need for a separate SubmitButton component when using `useActionState` |

**Deprecated / not applicable here:**
- `useFormState` (from `react-dom`): Renamed to `useActionState` and moved to `react` in React 19. Do not use `useFormState`.
- React Email components: Explicitly rejected by user. Raw HTML in template functions is the correct approach.

---

## Open Questions

1. **Form input reset on validation error**
   - What we know: Next.js 15 resets uncontrolled form inputs after a Server Action completes (including on error return). This is documented GitHub behavior.
   - What's unclear: Whether to use controlled inputs (more React code) or the `defaultValue` + returned values pattern (simpler server action, slightly more JSX).
   - Recommendation: Use the `defaultValue` approach — return `values` alongside `errors` from the action. Less state management, works with progressive enhancement.

2. **Date input `min` attribute for client-side past-date UX**
   - What we know: `<input type="date" min={today}>` prevents browser-native date picker from selecting past dates as a UX affordance.
   - What's unclear: Whether Claude should use this in addition to server validation.
   - Recommendation: Yes — use `min` attribute for the date picker UX, but server-side validation remains authoritative. The `min` value is the current date formatted as `YYYY-MM-DD` (can be computed on the client or passed as `defaultValue` from a Server Component wrapper).

3. **`RESEND_FROM` env var already exists in `lib/email/send.ts`**
   - What we know: Phase 1's `send.ts` reads `process.env.RESEND_FROM` with a fallback. The template function should not hardcode any school name.
   - What's unclear: Nothing — this is confirmed by reading the existing file. The template function receives names/dates as parameters; the `from` address is handled entirely by `send.ts`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no test config detected in project root |
| Config file | Wave 0 gap — see gaps below |
| Quick run command | `next build` (smoke test: catches import boundary violations, TypeScript errors) |
| Full suite command | `next build` + manual browser test |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORM-01 | All 8 fields (incl. optional reason) accepted and stored | integration (manual) | Submit form in browser, check Supabase dashboard | ❌ manual |
| FORM-02 | Inline errors appear for missing required fields | smoke (manual) | Submit empty form in browser; verify error messages appear per field | ❌ manual |
| FORM-03 | Submit button disabled while submitting | smoke (manual) | Submit form and observe button state during network delay | ❌ manual |
| FORM-04 | Past start date rejected; end before start rejected | smoke (manual) | Submit with start date yesterday and end date before start | ❌ manual |
| FORM-05 | Redirect to `/confirmation` after success | smoke (manual) | Submit valid form; verify URL changes to `/confirmation?status=submitted` | ❌ manual |
| REQ-01 | Row appears in `requests` table after submission | integration (manual) | Check Supabase Table Editor after successful submit | ❌ manual |
| REQ-02 | Blackout flagged → `auto_denied` status, no admin email | integration (manual) | Submit with blackout=Yes; verify `status=auto_denied` in Supabase; verify no admin email sent | ❌ manual |
| EMAIL-01 | Auto-denial email received with correct name, leave type, dates | integration (manual) | Submit blackout request; check test email inbox | ❌ manual |

**Key insight:** Phase 2 behavior is UI + DB + email — all three require runtime integration. `next build` is the only automated check: it catches TypeScript errors in the action (wrong types passed to `.insert()`), import boundary violations (Client Component importing from `lib/supabase/server.ts`), and missing `'use server'` directives. Every functional requirement needs manual verification.

### Sampling Rate

- **Per task commit:** `next build` — confirms no TypeScript or boundary errors
- **Per wave merge:** `next build` + submit a test form in `npm run dev` for each requirement
- **Phase gate:** All 8 requirements manually verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/email/templates/` directory — does not exist yet; create before implementing EMAIL-01
- [ ] No unit test framework needed — Phase 2 has no pure functions complex enough to warrant unit tests; all logic is integration-level
- [ ] `next build` must pass with zero TypeScript errors after each task — enforce via `strict: true` in tsconfig (already confirmed from Phase 1)

---

## Sources

### Primary (HIGH confidence)

- [Next.js Forms Guide](https://nextjs.org/docs/app/guides/forms) — `useActionState`, Server Actions with form, pending state, validation error pattern (official docs, version 16.1.6 / applicable to Next.js 15)
- [Next.js page.js API reference](https://nextjs.org/docs/app/api-reference/file-conventions/page) — `searchParams` is a Promise in Next.js 15, `await searchParams` pattern
- [Next.js redirect() reference](https://nextjs.org/docs/app/api-reference/functions/redirect) — redirect in Server Actions, must be outside try/catch, throws NEXT_REDIRECT
- [React useActionState reference](https://react.dev/reference/react/useActionState) — signature, prevState first param requirement
- Existing project files (`lib/email/send.ts`, `lib/supabase/server.ts`, `types/database.ts`) — confirmed Phase 1 output, typed insert API, RESEND_FROM env var handling

### Secondary (MEDIUM confidence)

- [Resend send-with-nextjs docs](https://resend.com/docs/send-with-nextjs) — `resend.emails.send({ html })` parameter structure, `{ data, error }` return pattern
- [Next.js useSearchParams reference](https://nextjs.org/docs/app/api-reference/functions/use-search-params) — Server Component pages use `searchParams` prop, not the hook; layouts cannot receive searchParams
- GitHub issue [#72949](https://github.com/vercel/next.js/issues/72949) — form inputs reset after server action in Next.js 15; `defaultValue` workaround pattern

### Tertiary (LOW confidence)

- WebSearch findings on date timezone off-by-one — consistent across multiple sources; cross-verified with JavaScript `Date` spec behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed from Phase 1; no new dependencies
- Architecture (Server Action + useActionState pattern): HIGH — confirmed via official Next.js and React 19 docs
- searchParams awaiting: HIGH — confirmed in official Next.js 15 page.js API reference
- Email template structure: HIGH — Resend html parameter confirmed; template pattern is pure TypeScript
- Pitfalls: HIGH — redirect/try-catch and searchParams confirmed in official docs; date timezone pitfall confirmed in JS spec; form reset is a known documented issue
- Date validation timezone subtlety: MEDIUM — behavior consistent with JS spec but not explicitly documented in Next.js docs

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days — Next.js 15.5.12 and React 19.1.0 are stable; no breaking changes expected in this window)
