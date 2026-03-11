# Phase 1: Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffold, database schema, lib module stubs, and security conventions established. No user-facing features delivered. Every subsequent phase depends on this base.

</domain>

<decisions>
## Implementation Decisions

### Database Schema — `requests` table

- Primary key: UUID (`gen_random_uuid()`)
- Columns: `id`, `teacher_name`, `teacher_email`, `leave_type` (enum), `start_date` (date), `end_date` (date), `reason` (text, nullable), `is_blackout` (boolean)
- Status tracking: `status` (enum), `submitted_at` (timestamptz), `reviewed_at` (timestamptz, nullable), `reviewed_by` (text, nullable)
- No soft delete column, no metadata columns (ip_address, user_agent)
- `leave_type` enum values: `sick`, `personal`, `vacation`, `bereavement`, `jury_duty`, `professional_development`, `maternity_paternity`
- `status` enum values: `pending`, `approved`, `denied`, `auto_denied`

### Database Schema — `blackout_dates` table

- Primary key: UUID (`gen_random_uuid()`)
- Columns: `id`, `label` (text), `start_date` (date), `end_date` (date), `created_at` (timestamptz)
- No `created_by` column

### Database — Type strategy

- `leave_type` and `status` are Postgres native enums (not text + CHECK)
- Enables automatic TypeScript type generation from Supabase

### Project Directory Layout

- Flat structure at project root (no `/src` wrapper)
- Route groups in `app/`: `(public)/` for teacher form, `(admin)/` for dashboard
- Shared reusable UI goes in `components/ui/`
- Route-specific components colocated next to their route (e.g., `app/(admin)/admin/_components/`)
- Layout: `app/layout.tsx` as root, separate layouts per route group

### Directory structure

```
app/
├── (public)/
│   ├── page.tsx          ← teacher form
│   └── confirmation/
├── (admin)/
│   ├── admin/
│   │   └── page.tsx      ← dashboard
│   └── admin/login/
├── api/
│   └── approve/
└── layout.tsx
components/
└── ui/
lib/
├── supabase/
├── email/
└── auth/
types/
public/
```

### Styling Baseline

- Default Tailwind CSS palette (no custom brand colors)
- Default Tailwind system font stack (no Google Fonts)
- Visual tone: clean and minimal — white backgrounds, subtle borders, standard form inputs
- No base component library (shadcn, etc.) — plain Tailwind classes

### Lib Module Contracts

**`lib/supabase/server.ts`**
- Exports a `createClient()` factory function
- Returns a typed Supabase client using the service role key (`SUPABASE_SERVICE_ROLE_KEY`)
- All DB queries across the app import from here — enforces server-only boundary
- No pre-built query helpers in Phase 1

**`lib/email/send.ts`**
- Initializes the Resend client
- Exports a typed `sendEmail({ to, subject, html })` wrapper function
- Email templates are HTML strings passed in by the callers (not bundled here)

**`lib/auth/session.ts`**
- Exports `getSession()`, `createSession()`, `destroySession()` using iron-session
- Thin wrapper — admin routes call these directly
- Does not include redirect logic (that stays in route handlers / middleware)

### Claude's Discretion

- Exact TypeScript tsconfig strictness settings
- Exact Supabase migration file naming convention
- Whether to generate Supabase types via CLI or handwrite the type definitions for stubs

</decisions>

<specifics>
## Specific Ideas

- No specific references — standard Next.js 15 App Router conventions apply throughout

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- None — greenfield project, no existing code

### Established Patterns

- All patterns established in this phase become the convention for Phases 2–4

### Integration Points

- `lib/supabase/server.ts` → imported by all server components and route handlers
- `lib/email/send.ts` → called from API route handlers (Phases 2, 3)
- `lib/auth/session.ts` → called by admin middleware and admin layout (Phase 4)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-10*
