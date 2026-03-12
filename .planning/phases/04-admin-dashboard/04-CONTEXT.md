# Phase 4: Admin Dashboard - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Password-protected admin dashboard with a requests table (filterable by status, sortable by column) and blackout date CRUD. Auth uses the existing `lib/auth/session.ts` iron-session implementation with middleware enforcement. No new email workflows — display and management only.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Navigation
- Single-page tab layout at `/admin` — two tabs: Requests (default) and Blackout Dates
- Tab state managed client-side (no separate routes, no URL params for tab state)
- Simple header: app/school name on the left, Logout button on the right
- 9-column requests table handles small screens via horizontal scroll — no column hiding

### Sort & Filter (Requests Table)
- Client-side filtering and sorting — all requests loaded on mount, JS handles interactions
- Status filter: pill/button group above the table — All | Pending | Approved | Denied | Auto-Denied
- Default sort: submitted_at descending (newest first)
- Column headers are clickable to sort; clicking the active sort column toggles ascending/descending
- Status badge colors: Pending → yellow, Approved → green, Denied → red, Auto-Denied → gray

### Blackout Date CRUD
- Always-visible inline add form above the list: Label + Start Date + End Date + Add button in a single row
- After successful add: form fields reset to empty, new date appears in the list immediately
- Delete: inline confirm pattern — Delete button changes to "Confirm? / Cancel" pair on first click; second click executes delete
- Empty state: "No blackout dates set." in gray text where the list would appear

### Login Page
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

</decisions>

<specifics>
## Specific Ideas

- No specific product references — standard admin dashboard conventions apply
- Inline confirm for delete (not browser confirm dialog or modal) was an explicit preference

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth/session.ts` → `getSession()`, `createSession()`, `destroySession()` — fully implemented; admin login route handler calls `createSession()`, logout calls `destroySession()`, layout calls `getSession()` to verify auth
- `lib/supabase/server.ts` → `createClient()` — used to fetch all requests and all blackout_dates in server components
- `types/database.ts` → `LeaveType`, `RequestStatus`, `Database` — typed DB rows ready to use in table components
- `lib/email/utils.ts` → `LEAVE_TYPE_LABELS`, `formatDate()` — use these for display formatting in the requests table

### Established Patterns
- Plain Tailwind CSS, no component library — all UI built with Tailwind classes
- Server-only DB queries via `createClient()` — admin page fetches requests/blackout_dates server-side, passes as props to client components for filtering/sorting
- Colocated components in `app/(admin)/admin/_components/` (established in Phase 1 CONTEXT)
- Centered white card on light gray background — teacher form pattern; apply to login page
- Server Action pattern for form submissions — apply to login and blackout date add/delete

### Integration Points
- `middleware.ts` → stub ready; needs: read session via `getSession()`, redirect to `/admin/login` if `!session.isLoggedIn`
- `app/(admin)/admin/layout.tsx` → needs to be created; reads session server-side and redirects if not logged in (CVE-2025-29927 dual-verification: both middleware AND layout check auth)
- `app/(admin)/admin/page.tsx` → replace stub with full dashboard (tab switcher, data fetching)
- `app/(admin)/admin/login/page.tsx` → replace stub with login form (useActionState for inline error)
- New: `app/(admin)/admin/actions.ts` (or `app/(admin)/admin/login/actions.ts`) — server actions for login, logout, add blackout date, delete blackout date

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-admin-dashboard*
*Context gathered: 2026-03-12*
