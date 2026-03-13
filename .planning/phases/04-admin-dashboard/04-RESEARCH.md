# Phase 4: Admin Dashboard - Research

**Researched:** 2026-03-12
**Domain:** Next.js 15 App Router admin layout, iron-session middleware auth, CVE-2025-29927 dual-verification, client-side sort/filter, Server Actions for CRUD, Tailwind 4 dashboard UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard Navigation**
- Single-page tab layout at `/admin` — two tabs: Requests (default) and Blackout Dates
- Tab state managed client-side (no separate routes, no URL params for tab state)
- Simple header: app/school name on the left, Logout button on the right
- 9-column requests table handles small screens via horizontal scroll — no column hiding

**Sort & Filter (Requests Table)**
- Client-side filtering and sorting — all requests loaded on mount, JS handles interactions
- Status filter: pill/button group above the table — All | Pending | Approved | Denied | Auto-Denied
- Default sort: submitted_at descending (newest first)
- Column headers are clickable to sort; clicking the active sort column toggles ascending/descending
- Status badge colors: Pending → yellow, Approved → green, Denied → red, Auto-Denied → gray

**Blackout Date CRUD**
- Always-visible inline add form above the list: Label + Start Date + End Date + Add button in a single row
- After successful add: form fields reset to empty, new date appears in the list immediately
- Delete: inline confirm pattern — Delete button changes to "Confirm? / Cancel" pair on first click; second click executes delete
- Empty state: "No blackout dates set." in gray text where the list would appear

**Login Page**
- Inline error handling — server action returns error state, React renders "Incorrect password. Please try again." below the submit button; no redirect
- Centered white card layout — consistent with the teacher form visual style (white card on light gray background)
- Standard password input — no show/hide toggle
- Unauthenticated access to `/admin/*`: middleware redirects to `/admin/login`

### Claude's Discretion
- Exact Tailwind classes, spacing, and typography throughout the dashboard
- Admin header exact wording/school name display
- Sort indicator arrow/icon design in column headers
- Exact pill active/inactive styling for the status filter
- Logout server action implementation details

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMIN-01 | Dashboard is protected by a password stored in `ADMIN_PASSWORD` env var with httpOnly cookie session | `lib/auth/session.ts` already implements `createSession()`, `destroySession()`, `getSession()` with iron-session; login Server Action compares formData password to `process.env.ADMIN_PASSWORD`, calls `createSession()` on match |
| ADMIN-02 | Admin auth is verified in both middleware and the admin layout (CVE-2025-29927 mitigation) | Middleware reads session and redirects to `/admin/login` if not logged in; layout.tsx independently calls `getSession()` and redirects — two independent checks means bypassing middleware alone is insufficient |
| ADMIN-03 | Requests tab shows all requests with 10 columns (including color-coded status badge) | Server component fetches all rows from `requests` table using `createClient()`, passes typed array to Client Component; `RequestStatus` type and `LEAVE_TYPE_LABELS` / `formatDate()` already exist |
| ADMIN-04 | Requests table is filterable by status | Client-side: `useState` for active filter, `Array.filter()` on the loaded requests array; pill/button group above table drives filter value |
| ADMIN-05 | Requests table columns are sortable by clicking column headers | Client-side: `useState` for `{ column: string, direction: 'asc' \| 'desc' }`, `Array.sort()` with toggling logic; sort indicator in column header |
| ADMIN-06 | Blackout Dates tab shows all date ranges with label, start date, and end date | Server component fetches all rows from `blackout_dates` table, passes typed array to Client Component for list rendering |
| ADMIN-07 | Admin can add a blackout date range with a label, start date, and end date | Server Action inserts into `blackout_dates` table; `useActionState` drives inline form; on success, clear fields and reflect new row immediately (optimistic or re-fetch via router.refresh()) |
| ADMIN-08 | Admin can delete any blackout date range | Server Action deletes by `id` from `blackout_dates`; inline confirm pattern — local `useState` tracks which `id` is in "pending confirm" state; second click executes delete |
</phase_requirements>

---

## Summary

Phase 4 implements the admin dashboard entirely within the existing stack. No new libraries are required. The core challenge is correctness of the auth layer (two independent checks to mitigate CVE-2025-29927), not UI complexity.

The dashboard page is a server component that fetches both `requests` and `blackout_dates` from Supabase using the existing `createClient()`, then passes typed data down to client components for interactive filtering/sorting and CRUD. All mutations go through Server Actions in a colocated `actions.ts` file. After mutations, `router.refresh()` re-fetches server data without a full page reload — this is the standard Next.js 15 pattern for updating server component data from a client component.

The login page follows the established `useActionState` pattern from the teacher form. The Server Action compares the submitted password to `process.env.ADMIN_PASSWORD`, calls `createSession()` on success and redirects to `/admin`, or returns an error state for inline display on failure.

**Primary recommendation:** Implement middleware and layout as two independent `getSession()` + redirect checks. Use `router.refresh()` after blackout date add/delete to re-sync server data. Keep filtering and sorting as pure `useMemo`-derived values from the loaded requests array to avoid stale-data bugs.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.12 (installed) | App Router, Server Components, Server Actions, middleware, layout | Project framework |
| iron-session | ^8.0.4 (installed) | httpOnly cookie session via `getSession()` / `createSession()` / `destroySession()` | Already implemented in `lib/auth/session.ts`; locked decision |
| @supabase/supabase-js | ^2.99.0 (installed) | Fetch requests and blackout_dates server-side; insert/delete blackout_dates | Project DB client |
| tailwindcss | ^4 (installed) | All dashboard UI styling | Project CSS framework; no component library in use |
| react | 19.1.0 (installed) | `useState`, `useMemo`, `useActionState`, `useTransition` for client-side interactivity | Project React version |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| server-only | ^0.0.1 (installed) | Already guards `lib/auth/session.ts` and `lib/supabase/server.ts` | No new `server-only` imports needed for Phase 4 files |
| next/navigation (`useRouter`, `redirect`) | Built into Next.js 15 | `router.refresh()` after mutations; `redirect()` in Server Actions on successful login | Standard navigation tools |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `router.refresh()` after mutation | `useOptimistic` | `useOptimistic` adds complexity; `router.refresh()` is simpler and correct for low-frequency admin CRUD |
| `useMemo` for derived filter/sort | Re-fetching on each filter/sort change | Re-fetching is slower and unnecessary — all data is already in memory per locked decision |
| Single-tab Server Action file `actions.ts` | Colocated per-page `login/actions.ts` | Colocated per-page files are cleaner for login; shared `admin/actions.ts` for logout + blackout CRUD is acceptable since they share the session check |

**Installation:** No new packages required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure (Phase 4 additions)

```
app/(admin)/admin/
├── layout.tsx                  # NEW: server component — getSession() → redirect if not logged in
├── page.tsx                    # REPLACE stub: server component — fetch requests + blackout_dates, render tab shell
├── actions.ts                  # NEW: Server Actions — logout, addBlackoutDate, deleteBlackoutDate
├── login/
│   ├── page.tsx                # REPLACE stub: useActionState login form
│   └── actions.ts              # NEW: Server Action — loginAdmin (compare password, createSession)
└── _components/
    ├── RequestsTab.tsx         # NEW: 'use client' — filter pills + sortable table
    ├── BlackoutDatesTab.tsx    # NEW: 'use client' — add form + list with inline delete confirm
    └── TabSwitcher.tsx         # NEW: 'use client' — tab state (or inline in page if simple)
middleware.ts                   # REPLACE stub: getSession() → redirect /admin/* to /admin/login if not logged in
```

### Pattern 1: CVE-2025-29927 Dual-Verification (ADMIN-02)

**What:** Next.js middleware can be bypassed by sending `x-middleware-subrequest` header. The fix is to verify auth in BOTH middleware AND the layout/page — two independent checks.
**When to use:** Any password-protected admin area in Next.js App Router.

```typescript
// middleware.ts — Source: iron-session docs + CVE-2025-29927 mitigation pattern
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'

export async function middleware(request: NextRequest) {
  const session = await getSession()
  const isLoginPage = request.nextUrl.pathname === '/admin/login'

  if (!session.isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // Redirect logged-in users away from login page
  if (session.isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

```typescript
// app/(admin)/admin/layout.tsx — second independent check
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    redirect('/admin/login')
  }
  return <>{children}</>
}
```

### Pattern 2: Login Server Action with useActionState

**What:** Server Action validates password, calls `createSession()` + `redirect()` on success, returns error state on failure. Client renders error inline via `useActionState`.
**When to use:** Single-password login form — established project pattern from teacher form.

```typescript
// app/(admin)/admin/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth/session'

export type LoginState = { error?: string }

export async function loginAdmin(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get('password') as string

  if (password !== process.env.ADMIN_PASSWORD) {
    return { error: 'Incorrect password. Please try again.' }
  }

  await createSession()
  redirect('/admin')  // outside try/catch — NEXT_REDIRECT must not be swallowed
}
```

```typescript
// app/(admin)/admin/login/page.tsx
'use client'
import { useActionState } from 'react'
import { loginAdmin, type LoginState } from './actions'

const initialState: LoginState = {}

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAdmin, initialState)

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Admin Login</h1>
        <form action={formAction}>
          <div className="mb-5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {state.error && (
            <p className="mb-4 text-sm text-red-600">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

### Pattern 3: Server Component Data Fetch → Client Component Props

**What:** Admin dashboard page is a server component that fetches both data sets and passes as props to interactive client components.
**When to use:** Any page needing server-side DB access + client-side interactivity.

```typescript
// app/(admin)/admin/page.tsx — server component
import { createClient } from '@/lib/supabase/server'
import RequestsTab from './_components/RequestsTab'
import BlackoutDatesTab from './_components/BlackoutDatesTab'
import type { Database } from '@/types/database'

type RequestRow = Database['public']['Tables']['requests']['Row']
type BlackoutDateRow = Database['public']['Tables']['blackout_dates']['Row']

export default async function AdminDashboardPage() {
  const supabase = createClient()

  const [{ data: requests }, { data: blackoutDates }] = await Promise.all([
    supabase.from('requests').select('*').order('submitted_at', { ascending: false }),
    supabase.from('blackout_dates').select('*').order('start_date', { ascending: true }),
  ])

  return (
    // Tab shell passes data to client components
    <DashboardShell
      requests={requests ?? []}
      blackoutDates={blackoutDates ?? []}
    />
  )
}
```

### Pattern 4: Client-Side Sort and Filter

**What:** All requests loaded on mount; filter and sort are pure `useMemo` computations on the loaded array.
**When to use:** Small-to-medium datasets where client-side JS is faster than round-trip re-fetches.

```typescript
// app/(admin)/admin/_components/RequestsTab.tsx
'use client'
import { useState, useMemo } from 'react'
import type { Database } from '@/types/database'
import { LEAVE_TYPE_LABELS, formatDate } from '@/lib/email/utils'

type RequestRow = Database['public']['Tables']['requests']['Row']
type SortColumn = keyof RequestRow
type SortDirection = 'asc' | 'desc'

export default function RequestsTab({ requests }: { requests: RequestRow[] }) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'submitted_at',
    direction: 'desc',
  })

  function handleColumnClick(column: SortColumn) {
    setSort(prev =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' }
    )
  }

  const filtered = useMemo(() => {
    return statusFilter === 'all'
      ? requests
      : requests.filter(r => r.status === statusFilter)
  }, [requests, statusFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sort.column] ?? ''
      const bv = b[sort.column] ?? ''
      const cmp = String(av).localeCompare(String(bv))
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort])

  // Render filter pills, table headers with sort indicators, table rows...
}
```

### Pattern 5: Blackout Date Add/Delete with router.refresh()

**What:** Server Actions mutate DB; `router.refresh()` re-fetches server component data to reflect changes. Inline confirm pattern uses `useState` to track pending delete id.
**When to use:** Client component that needs to reflect server-side mutations without a full page reload.

```typescript
// app/(admin)/admin/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'

export async function addBlackoutDate(prevState: unknown, formData: FormData) {
  const label = formData.get('label') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  if (!label || !start_date || !end_date) {
    return { error: 'All fields are required.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('blackout_dates').insert({ label, start_date, end_date })

  if (error) return { error: 'Failed to add blackout date.' }
  return { success: true }
}

export async function deleteBlackoutDate(id: string) {
  const supabase = createClient()
  await supabase.from('blackout_dates').delete().eq('id', id)
}

export async function logoutAdmin() {
  const { destroySession } = await import('@/lib/auth/session')
  await destroySession()
  const { redirect } = await import('next/navigation')
  redirect('/admin/login')
}
```

```typescript
// In BlackoutDatesTab.tsx — router.refresh() after mutation
'use client'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { addBlackoutDate, deleteBlackoutDate } from '../actions'

export default function BlackoutDatesTab({ blackoutDates }) {
  const router = useRouter()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [addState, addAction, addPending] = useActionState(
    async (prev, formData) => {
      const result = await addBlackoutDate(prev, formData)
      if (result?.success) router.refresh()
      return result
    },
    null
  )

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteBlackoutDate(id)
      setPendingDeleteId(null)
      router.refresh()
    })
  }
  // ...
}
```

### Anti-Patterns to Avoid

- **Verifying auth only in middleware:** The CVE-2025-29927 bypass sends `x-middleware-subrequest` to skip middleware. The layout must independently verify. Both checks are required.
- **Calling `redirect()` inside try/catch in Server Actions:** NEXT_REDIRECT is swallowed by catch. Place `redirect()` after the try/catch or as the final statement. Established project rule.
- **Importing `lib/auth/session.ts` in client components:** It has `import 'server-only'` — the build will fail. Only call session functions from Server Components, Server Actions, or middleware.
- **Mutating state with `useState` directly after Server Action:** Use `router.refresh()` to re-sync server data; do not try to patch client state manually to reflect DB changes.
- **Using `window.confirm()` for delete:** Decision is inline confirm pattern — Delete → "Confirm? / Cancel" pair via `useState`. No browser dialog.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| httpOnly cookie session | Custom session management | `iron-session` via `lib/auth/session.ts` (already implemented) | Handles encryption, cookie options, expiry; already tested against this stack |
| Password comparison | Timing-safe compare, bcrypt | Simple string equality (`password === process.env.ADMIN_PASSWORD`) | Locked decision; single shared password, not user accounts |
| Sort logic | Custom comparison algorithms | `Array.sort()` with `String.localeCompare()` | Works for all column types; handles null/undefined gracefully with `?? ''` |
| Data re-sync after mutation | WebSocket, polling, complex state sync | `router.refresh()` from `next/navigation` | Built-in Next.js 15 mechanism for re-fetching server component data |
| Tab routing | URL-based tabs with `useSearchParams` | `useState` for active tab | Locked decision — tab state is client-only |

**Key insight:** All infrastructure exists. Phase 4 is purely assembly — wiring session.ts, createClient(), Server Actions, and React state together in the admin route group.

---

## Common Pitfalls

### Pitfall 1: Middleware-Only Auth (CVE-2025-29927)

**What goes wrong:** Middleware is the only auth check. Attacker sends `x-middleware-subrequest: pages-router-edge-server/next-edge-server` header — middleware is skipped, dashboard is exposed.
**Why it happens:** Next.js processes this internal header to prevent infinite loops; it was abusable in some versions.
**How to avoid:** Always add a second independent `getSession()` check in `app/(admin)/admin/layout.tsx`. The layout runs server-side for every admin route regardless of middleware state.
**Warning signs:** Accessing `/admin` with `curl -H 'x-middleware-subrequest: ...'` succeeds without a cookie.

### Pitfall 2: `getSession()` in Middleware Requires Special Handling

**What goes wrong:** `lib/auth/session.ts` imports `cookies` from `next/headers`, which requires the Next.js server runtime. Middleware runs in the Edge runtime. Calling `getSession()` in middleware may throw if iron-session or `next/headers` isn't compatible with Edge.
**Why it happens:** Iron-session v8 supports Edge runtime for cookie reading, but the import chain must not include Node.js-only modules.
**How to avoid:** The existing `session.ts` uses `import 'server-only'` which prevents Edge runtime use. Middleware must use the `cookies()` from `next/headers` and `getIronSession()` directly (not via `lib/auth/session.ts`) OR the `matcher` must route only to pages and the session check is handled by removing `import 'server-only'` from session.ts for middleware use.
**Recommended approach:** In middleware, read the iron-session cookie directly using `request.cookies.get('admin-session')` or duplicate the `getIronSession()` call inline in middleware without importing from `lib/auth/session.ts`. This avoids the `server-only` constraint. The layout uses the full `lib/auth/session.ts` import as normal.
**Warning signs:** Build error: "You're importing a component that needs 'server-only'..." during middleware compilation.

### Pitfall 3: `router.refresh()` vs. Stale Props

**What goes wrong:** After a Server Action (add/delete blackout date) completes, the client component still shows stale data because `router.refresh()` was not called, or was called before the Server Action completed.
**Why it happens:** Server component props are passed once at render time; mutations do not automatically re-fetch.
**How to avoid:** Call `router.refresh()` in the callback after the Server Action resolves (not before). Use `useTransition` or `useActionState` to know when the action is complete.
**Warning signs:** Deleted blackout date still appears in list; added date doesn't appear without manual page reload.

### Pitfall 4: Sort on Null/Undefined Column Values

**What goes wrong:** Sorting by `reason` or `reviewed_by` (nullable columns) causes `null.localeCompare()` TypeError.
**Why it happens:** TypeScript types show `string | null` for nullable columns; sort logic must handle null.
**How to avoid:** Always coerce with `String(value ?? '')` before calling `localeCompare()`.
**Warning signs:** Runtime crash when clicking "Reason" or "Reviewed By" column header; console shows TypeError.

### Pitfall 5: `useActionState` Form Reset After Successful Add

**What goes wrong:** After a successful blackout date add, the form inputs still show the previously submitted values because uncontrolled inputs don't auto-reset in Next.js 15.
**Why it happens:** Same as Phase 2 teacher form issue — Next.js 15 resets uncontrolled inputs after a Server Action but only if a key prop forces re-mount.
**How to avoid:** Track a `formKey` counter in state; increment it on successful add; pass `key={formKey}` to the form element to force a re-mount. Alternatively, use controlled inputs with `useState` per field and reset manually on success.
**Warning signs:** Form fields retain old values after a successful add.

### Pitfall 6: Status Filter Value Mismatch

**What goes wrong:** Status filter uses display strings ("Auto-Denied") but `RequestStatus` type uses `'auto_denied'`. Filter never matches.
**Why it happens:** UI labels differ from DB enum values.
**How to avoid:** Filter state values must match `RequestStatus` literals exactly: `'pending' | 'approved' | 'denied' | 'auto_denied'`. The filter pill buttons display human-readable labels ("Auto-Denied") but store/compare the DB value (`'auto_denied'`).
**Warning signs:** Auto-Denied filter pill shows 0 results even when auto-denied records exist.

---

## Code Examples

### Status Badge Color Map

```typescript
// Derived from locked decisions: Pending→yellow, Approved→green, Denied→red, Auto-Denied→gray
const STATUS_BADGE: Record<RequestStatus, { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'bg-yellow-100 text-yellow-800' },
  approved:   { label: 'Approved',   className: 'bg-green-100 text-green-800' },
  denied:     { label: 'Denied',     className: 'bg-red-100 text-red-800' },
  auto_denied: { label: 'Auto-Denied', className: 'bg-gray-100 text-gray-600' },
}
```

### Status Filter Pill Group

```typescript
// Filter pill values match RequestStatus literals; labels are display strings
const FILTER_OPTIONS = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'approved',   label: 'Approved' },
  { value: 'denied',     label: 'Denied' },
  { value: 'auto_denied', label: 'Auto-Denied' },
]
```

### Inline Delete Confirm Pattern

```typescript
// useState tracks which id is awaiting confirmation
const [confirmId, setConfirmId] = useState<string | null>(null)

// In the list row:
{confirmId === row.id ? (
  <>
    <button onClick={() => handleDelete(row.id)}>Confirm?</button>
    <button onClick={() => setConfirmId(null)}>Cancel</button>
  </>
) : (
  <button onClick={() => setConfirmId(row.id)}>Delete</button>
)}
```

### Middleware Session Check (without server-only import)

```typescript
// middleware.ts — read iron-session cookie directly, avoid lib/auth/session.ts (has 'server-only')
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { AdminSessionData } from '@/lib/auth/session'

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'admin-session',
  cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const },
}

export async function middleware(request: NextRequest) {
  const cookieStore = await cookies()
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions)
  const isLoginPage = request.nextUrl.pathname === '/admin/login'

  if (!session.isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  if (session.isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
  return NextResponse.next()
}
```

### Supabase Parallel Fetch (Promise.all)

```typescript
// Source: supabase-js docs + project createClient() pattern
const supabase = createClient()
const [{ data: requests, error: reqError }, { data: blackoutDates }] = await Promise.all([
  supabase.from('requests').select('*').order('submitted_at', { ascending: false }),
  supabase.from('blackout_dates').select('*').order('start_date', { ascending: true }),
])
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cookies()` synchronous | `await cookies()` — async in Next.js 15 | Next.js 15 | Must `await` in both middleware and session.ts (already done in session.ts) |
| Single middleware auth check | Dual check: middleware + layout (CVE-2025-29927) | 2025 CVE disclosure | Layout must independently verify session |
| `searchParams` sync access | `const params = await searchParams` | Next.js 15 | Any page receiving `searchParams` prop must await it |

**Deprecated/outdated:**
- `app/(admin)/admin/page.tsx` stub: replace entirely with full dashboard
- `app/(admin)/admin/login/page.tsx` stub: replace with login form
- `middleware.ts` stub (pass-through): replace with iron-session check

---

## Open Questions

1. **`server-only` in middleware context**
   - What we know: `lib/auth/session.ts` has `import 'server-only'`, which prevents use in Edge runtime (where middleware may run). Iron-session v8 supports Edge runtime for its own operations.
   - What's unclear: Whether `next/headers`' `cookies()` function is available in the middleware Edge runtime in Next.js 15.5.12.
   - Recommendation: Duplicate the `getIronSession()` call inline in middleware (copying `sessionOptions` constant) rather than importing from `lib/auth/session.ts`. This is already documented in the Code Examples section. The CONTEXT.md notes middleware needs to "read session via `getSession()`" — this may need to be a local inline call rather than the shared function. The layout can use the shared `getSession()` normally.

2. **Logout Server Action — redirect destination**
   - What we know: `destroySession()` is already implemented. Logout should clear session and redirect to `/admin/login`.
   - What's unclear: Whether the logout button should be a `<form>` with a Server Action or a `<button onClick>` calling a bound action.
   - Recommendation (Claude's discretion): Use a `<form action={logoutAction}>` with a submit button. This is the canonical Next.js pattern for logout — no client-side JS required, works without hydration.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — build + lint only (same as Phase 3) |
| Config file | None |
| Quick run command | `npm run lint` |
| Full suite command | `npm run lint && npm run build` |

No test framework is installed. All behavioral verification is manual smoke testing or build-time type checking, consistent with prior phases.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Login form with password check, httpOnly cookie session | manual smoke | `npm run build` (type check) | ❌ Wave 0 |
| ADMIN-02 | Auth verified in both middleware and layout | manual smoke | `npm run build` (type check) | ❌ Wave 0 |
| ADMIN-03 | Requests tab shows all columns with status badge | manual smoke | `npm run build` (type check) | ❌ Wave 0 |
| ADMIN-04 | Status filter pills filter table correctly | manual smoke | `npm run build` (type check) | ❌ Wave 0 |
| ADMIN-05 | Column sort toggles asc/desc | manual smoke | `npm run build` (type check) | ❌ Wave 0 |
| ADMIN-06 | Blackout Dates tab lists all ranges | manual smoke | `npm run build` (type check) | ❌ Wave 0 |
| ADMIN-07 | Add form inserts new range, list updates | manual smoke | `npm run build` (type check) | ❌ Wave 0 |
| ADMIN-08 | Inline confirm delete removes range, list updates | manual smoke | `npm run build` (type check) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run lint`
- **Per wave merge:** `npm run lint && npm run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Manual Smoke Test Checklist (for verify-work)

| Behavior | Steps |
|----------|-------|
| Auth redirect | Navigate to `/admin` without cookie → should redirect to `/admin/login` |
| CVE-2025-29927 bypass blocked | `curl http://localhost:3000/admin -H 'x-middleware-subrequest: pages-router-edge-server/next-edge-server'` → should still redirect to login (layout check blocks it) |
| Wrong password | Submit login with wrong password → inline error, no redirect |
| Correct password | Submit login with correct password → redirected to `/admin`, dashboard visible |
| Logout | Click Logout → redirected to `/admin/login`, cookie cleared |
| Requests tab | All requests visible; columns match ADMIN-03; status badges color-coded correctly |
| Filter | Click "Pending" pill → only pending rows shown; "All" restores all rows |
| Sort | Click any column header → rows re-sort; click again → direction toggles |
| Blackout Dates tab | All existing ranges listed |
| Add blackout date | Fill form, click Add → new range appears, form clears |
| Delete blackout date | Click Delete → Confirm/Cancel appears; click Confirm → row removed |

### Wave 0 Gaps

- [ ] `app/(admin)/admin/layout.tsx` — does not exist yet
- [ ] `app/(admin)/admin/actions.ts` — does not exist yet
- [ ] `app/(admin)/admin/login/actions.ts` — does not exist yet
- [ ] `app/(admin)/admin/_components/` directory — does not exist yet
- [ ] `npm run build` baseline must pass before wave 1 begins

---

## Sources

### Primary (HIGH confidence)

- Existing project code: `lib/auth/session.ts`, `lib/supabase/server.ts`, `types/database.ts`, `lib/email/utils.ts`, `middleware.ts`, `app/(public)/page.tsx`, `app/(public)/actions.ts`
- Next.js 15 App Router layout docs — https://nextjs.org/docs/app/api-reference/file-conventions/layout
- iron-session v8 README — https://github.com/vvo/iron-session (verified: supports Next.js 15, `await cookies()` pattern required)
- CVE-2025-29927 Next.js middleware bypass — https://nextjs.org/blog/cve-2025-29927

### Secondary (MEDIUM confidence)

- Next.js `router.refresh()` docs — https://nextjs.org/docs/app/api-reference/functions/use-router#routerrefresh
- Next.js `useActionState` with Server Actions — https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified in prior phases; no new dependencies
- Architecture: HIGH — patterns are extensions of established Phase 2/3 patterns from existing codebase
- CVE-2025-29927 mitigation: HIGH — documented in official Next.js blog post; dual-check pattern is the prescribed fix
- Pitfalls: HIGH — server-only/middleware conflict and null sort values are concrete code-level issues derived from actual project constraints

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable stack; iron-session and Next.js 15 are stable)
