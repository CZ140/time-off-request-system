# Phase 1: Foundation - Research

**Researched:** 2026-03-10
**Domain:** Next.js 15 App Router, Supabase (server-side only), iron-session, environment variable security
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Database Schema — `requests` table:** UUID primary key (`gen_random_uuid()`); columns: `id`, `teacher_name`, `teacher_email`, `leave_type` (enum), `start_date` (date), `end_date` (date), `reason` (text, nullable), `is_blackout` (boolean), `status` (enum), `submitted_at` (timestamptz), `reviewed_at` (timestamptz, nullable), `reviewed_by` (text, nullable). No soft delete, no metadata columns.
- **`leave_type` enum values:** `sick`, `personal`, `vacation`, `bereavement`, `jury_duty`, `professional_development`, `maternity_paternity`
- **`status` enum values:** `pending`, `approved`, `denied`, `auto_denied`
- **Database Schema — `blackout_dates` table:** UUID primary key; columns: `id`, `label` (text), `start_date` (date), `end_date` (date), `created_at` (timestamptz). No `created_by`.
- **Type strategy:** Postgres native enums (not text + CHECK constraint)
- **Project structure:** Flat at project root (no `/src`). Route groups: `app/(public)/`, `app/(admin)/`. Shared UI in `components/ui/`. Route-specific components colocated next to route.
- **Directory layout:** Exactly as specified in CONTEXT.md (see Architecture Patterns section below)
- **Styling:** Default Tailwind CSS palette and font stack. No custom brand colors, no Google Fonts, no shadcn or other component library.
- **`lib/supabase/server.ts`:** Exports `createClient()` factory using `SUPABASE_SERVICE_ROLE_KEY`. All DB queries import from here. No pre-built query helpers in Phase 1.
- **`lib/email/send.ts`:** Initializes Resend client. Exports `sendEmail({ to, subject, html })` wrapper. Templates are HTML strings from callers.
- **`lib/auth/session.ts`:** Exports `getSession()`, `createSession()`, `destroySession()` using iron-session. Thin wrapper, no redirect logic.
- **Framework:** Next.js 15 (user-confirmed, not 16 even though 16 is current npm latest)
- **Auth:** iron-session (not NextAuth/OAuth)
- **Email:** Raw HTML via Resend (not React Email)
- **Token strategy:** Shared `APPROVAL_SECRET` in query params (not per-admin JWT)
- **Supabase:** Anon key server-side only; no RLS dependency

### Claude's Discretion

- Exact TypeScript tsconfig strictness settings
- Exact Supabase migration file naming convention
- Whether to generate Supabase types via CLI or handwrite type definitions for stubs

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Supabase anon key is never exposed to the browser — all DB queries run server-side only | `server-only` package enforces import boundary; `createClient()` in `lib/supabase/server.ts` using service role key never reaches client bundle |
| SEC-02 | `APPROVAL_SECRET`, `ADMIN_PASSWORD`, and `SUPABASE_SERVICE_ROLE_KEY` never use the `NEXT_PUBLIC_` prefix | Env var naming conventions documented; `NEXT_PUBLIC_` prefix is the only mechanism Next.js uses to expose vars to the browser bundle |
</phase_requirements>

---

## Summary

This phase scaffolds a Next.js 15 App Router project with the exact directory layout, Supabase schema, and lib module stubs the user has locked in CONTEXT.md. It is a greenfield setup — no existing code to integrate. Every pattern established here becomes the convention for Phases 2–4.

The dominant technical concern is the `NEXT_PUBLIC_` prefix rule for environment variables: any var without this prefix is server-only by default in Next.js. The `server-only` npm package adds a build-time compile error as a second layer of protection, ensuring `lib/supabase/server.ts` can never be accidentally imported into a Client Component. Together these enforce SEC-01 and SEC-02 mechanically, not just by convention.

Next.js 16 is the current npm `latest` (v16.1.6 as of March 2026), which means `npx create-next-app@latest` will scaffold Next.js 16. The user has confirmed Next.js 15. The correct bootstrap command is `npx create-next-app@next15` or pinning to `next@15.5.12` (latest stable 15.x). This is the highest-priority gotcha for the setup task.

**Primary recommendation:** Bootstrap with `npx create-next-app@latest --no` to take control of options, then pin `next` to `^15.5.12` in `package.json`, or scaffold with `npx create-next-app@15`. Install `server-only` in `lib/supabase/server.ts` as the import boundary guard from day one.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.12 | App framework — App Router, server components, API routes | User-confirmed; 15.x is stable LTS-equivalent |
| react + react-dom | 19.x (bundled with Next 15) | UI runtime | Ships with Next.js 15 |
| typescript | 5.x | Type safety | Default in create-next-app; required for Supabase type gen |
| tailwindcss | 3.x or 4.x | Utility CSS | Default in create-next-app; user chose plain Tailwind |
| @supabase/supabase-js | 2.99.0 | Database client | Official Supabase JS client; v2 is current stable |
| iron-session | 8.0.4 | Encrypted httpOnly cookie sessions | User-chosen; lightweight, no auth server needed |
| server-only | 0.0.1 | Build-time import boundary guard | npm standard; throws at compile time if imported in client |
| resend | 6.9.3 | Transactional email | User-chosen; stub only in Phase 1, used in Phase 2+ |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | latest | Node type definitions | Needed for `process.env` typing in TypeScript strict mode |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| iron-session | NextAuth | NextAuth is heavier, designed for OAuth/social login. iron-session is ideal for single shared password |
| @supabase/supabase-js direct | @supabase/ssr | @supabase/ssr adds cookie-based auth helpers; unnecessary here since no RLS / user auth |
| Raw HTML email | React Email | React Email adds build complexity; user explicitly rejected it |

**Installation:**

```bash
# Use the versioned create-next-app to avoid accidentally getting Next.js 16
npx create-next-app@15 time-off-request-system --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"

# Add remaining dependencies
npm install @supabase/supabase-js iron-session resend server-only
npm install --save-dev @types/node
```

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── (public)/
│   ├── page.tsx          # teacher submission form
│   └── confirmation/
│       └── page.tsx
├── (admin)/
│   ├── admin/
│   │   ├── page.tsx      # dashboard
│   │   └── _components/  # admin-specific components
│   └── admin/login/
│       └── page.tsx
├── api/
│   └── approve/
│       └── route.ts
└── layout.tsx            # root layout
components/
└── ui/                   # shared reusable UI components
lib/
├── supabase/
│   └── server.ts         # createClient() factory
├── email/
│   └── send.ts           # sendEmail() wrapper
└── auth/
    └── session.ts        # getSession / createSession / destroySession
types/
└── database.ts           # Supabase-generated or handwritten DB types
public/
```

### Pattern 1: Server-Only Supabase Client

**What:** A factory function in `lib/supabase/server.ts` that creates a typed Supabase client using the service role key. The `server-only` sentinel import prevents it from ever reaching the client bundle.

**When to use:** Import this factory in every Server Component, Route Handler, or Server Action that needs DB access. Never create Supabase clients inline or in client components.

**Example:**

```typescript
// lib/supabase/server.ts
// Source: https://github.com/orgs/supabase/discussions/30739
import 'server-only'
import { createClient as _createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createClient() {
  return _createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
```

Key points:
- `SUPABASE_URL` has no `NEXT_PUBLIC_` prefix — server-only
- `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix — server-only
- `persistSession: false` — service role clients must not persist sessions
- The `server-only` import causes a build error if this module is ever imported in a Client Component

### Pattern 2: iron-session in Next.js 15 (await cookies())

**What:** `getIronSession()` accepts the awaited `cookies()` store from `next/headers`. In Next.js 15, `cookies()` is async and MUST be awaited.

**When to use:** In Route Handlers and Server Actions that manage the admin session.

**Example:**

```typescript
// lib/auth/session.ts
// Source: https://github.com/vvo/iron-session
import 'server-only'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface AdminSessionData {
  isLoggedIn: boolean
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'admin-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<AdminSessionData>(cookieStore, sessionOptions)
}

export async function createSession() {
  const session = await getSession()
  session.isLoggedIn = true
  await session.save()
}

export async function destroySession() {
  const session = await getSession()
  session.destroy()
}
```

Critical: `cookies()` must be `await`-ed before passing to `getIronSession`. Forgetting this is the #1 iron-session + Next.js 15 mistake.

### Pattern 3: Environment Variable Security (SEC-01 and SEC-02)

**What:** Next.js only exposes vars prefixed with `NEXT_PUBLIC_` to the browser bundle. All other vars are server-only by default.

**When to use:** Every env var containing a secret must have no `NEXT_PUBLIC_` prefix.

**Example `.env.local`:**

```bash
# .env.local — NEVER commit this file

# Supabase — server-side only (no NEXT_PUBLIC_ prefix)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Email
RESEND_API_KEY=re_...
ADMIN_EMAILS=admin@school.edu,principal@school.edu

# Approval workflow
APPROVAL_SECRET=a-long-random-secret-string

# Admin auth
ADMIN_PASSWORD=another-long-random-secret
SESSION_SECRET=32-character-minimum-secret-for-iron-session

# Note: SESSION_SECRET must be at least 32 characters for iron-session
```

### Pattern 4: Postgres Native Enum + Supabase Migration

**What:** Define enum types in a SQL migration file; Supabase runs these against the hosted Postgres instance.

**When to use:** Schema setup in Wave 0 of Phase 1.

**Example migration (`supabase/migrations/20260310000000_initial_schema.sql`):**

```sql
-- Create native Postgres enums
CREATE TYPE leave_type AS ENUM (
  'sick',
  'personal',
  'vacation',
  'bereavement',
  'jury_duty',
  'professional_development',
  'maternity_paternity'
);

CREATE TYPE request_status AS ENUM (
  'pending',
  'approved',
  'denied',
  'auto_denied'
);

-- requests table
CREATE TABLE requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name   TEXT NOT NULL,
  teacher_email  TEXT NOT NULL,
  leave_type     leave_type NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  reason         TEXT,
  is_blackout    BOOLEAN NOT NULL DEFAULT false,
  status         request_status NOT NULL DEFAULT 'pending',
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    TEXT
);

-- blackout_dates table
CREATE TABLE blackout_dates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label      TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Migration file naming convention (Claude's discretion): `YYYYMMDDHHMMSS_description.sql` — matches Supabase CLI convention.

### Pattern 5: TypeScript Database Types

**What:** Type definitions that describe the Supabase schema, used to type the `createClient<Database>()` call.

**Two options (Claude's discretion):**

Option A — Generate via CLI (requires Supabase CLI and linked project):
```bash
npx supabase gen types typescript --project-id <project-ref> > types/database.ts
```

Option B — Handwrite stubs (simpler, works offline, sufficient for Phase 1):
```typescript
// types/database.ts — handwritten stub
export type Database = {
  public: {
    Tables: {
      requests: {
        Row: {
          id: string
          teacher_name: string
          teacher_email: string
          leave_type: 'sick' | 'personal' | 'vacation' | 'bereavement' | 'jury_duty' | 'professional_development' | 'maternity_paternity'
          start_date: string
          end_date: string
          reason: string | null
          is_blackout: boolean
          status: 'pending' | 'approved' | 'denied' | 'auto_denied'
          submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['requests']['Row'], 'id' | 'submitted_at'> & { id?: string; submitted_at?: string }
        Update: Partial<Database['public']['Tables']['requests']['Row']>
      }
      blackout_dates: {
        Row: {
          id: string
          label: string
          start_date: string
          end_date: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['blackout_dates']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['blackout_dates']['Row']>
      }
    }
    Enums: {
      leave_type: 'sick' | 'personal' | 'vacation' | 'bereavement' | 'jury_duty' | 'professional_development' | 'maternity_paternity'
      request_status: 'pending' | 'approved' | 'denied' | 'auto_denied'
    }
  }
}
```

**Recommendation:** Handwrite stubs in Phase 1 (simpler, no CLI setup dependency). Re-generate via CLI after schema is finalized.

### Anti-Patterns to Avoid

- **Using `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`:** Exposes the master key to every browser session. Never acceptable.
- **Calling `cookies()` without `await` in Next.js 15:** `cookies()` returns a Promise in Next.js 15. Synchronous access still works but emits deprecation warnings and will break in Next.js 16.
- **Using `createClient` from `@supabase/ssr` for service role:** The `@supabase/ssr` package is designed for user-session auth, not service role. Use `@supabase/supabase-js` directly.
- **Creating Supabase client inline in route handlers:** Defeats the purpose of `lib/supabase/server.ts` as a single boundary. Always use the factory.
- **Putting redirect logic in `lib/auth/session.ts`:** Session lib is a thin wrapper. Redirects belong in middleware/proxy or route handlers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypted cookie sessions | Custom JWT or cookie signing | `iron-session` | iron-session handles encryption, signing, expiry, and padding attacks |
| Server/client import boundary | Manual ESLint rules | `server-only` npm package | Compile-time error; ESLint rules are opt-in and bypassable |
| DB query typing | Manual type assertions | Supabase `Database` generic + `createClient<Database>()` | Type-safe `.from()`, `.select()`, `.insert()` with no casting |
| Email sending | `nodemailer` / raw SMTP | `resend` | Resend handles deliverability, SPF/DKIM; simpler API for transactional email |

**Key insight:** The security layer in this phase is structural, not behavioral. Use packages that make the right thing easy and the wrong thing a build error.

---

## Common Pitfalls

### Pitfall 1: `create-next-app@latest` Installs Next.js 16

**What goes wrong:** Running `npx create-next-app@latest` in March 2026 scaffolds Next.js 16.1.6, not 15.x. Next.js 16 renames `middleware.ts` to `proxy.ts`, makes Turbopack the default, and removes several deprecated APIs.

**Why it happens:** npm `latest` tag always points to the newest stable release.

**How to avoid:** Use `npx create-next-app@15` (version-scoped) or manually set `"next": "^15.5.12"` in package.json after scaffolding.

**Warning signs:** `package.json` shows `"next": "^16.x.x"` or `next --version` outputs `16.x`.

### Pitfall 2: Forgetting `await` on `cookies()`

**What goes wrong:** `const session = getIronSession(cookies(), ...)` — passing the Promise, not the resolved store. This causes a runtime type error or silent malfunction.

**Why it happens:** Next.js 14 had synchronous `cookies()`. Next.js 15 changed it to async. iron-session v8 expects the resolved ReadonlyRequestCookies object, not a Promise.

**How to avoid:** Always write `const cookieStore = await cookies()` before passing to `getIronSession`.

**Warning signs:** Session data appears undefined; `session.save()` throws unexpectedly.

### Pitfall 3: Accidentally Exposing Service Role Key

**What goes wrong:** A developer adds `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` or imports `lib/supabase/server.ts` in a Client Component, embedding the key in the JS bundle.

**Why it happens:** The `NEXT_PUBLIC_` prefix is easy to type by habit when adding Supabase env vars (the anon key pattern uses it).

**How to avoid:**
1. Never use `NEXT_PUBLIC_` prefix on any secret.
2. Add `import 'server-only'` as the first line of `lib/supabase/server.ts` — this causes a build error if the file is imported anywhere in the client bundle.

**Warning signs:** Browser DevTools Network tab shows the service role key in the JS source; no build error when importing the server module in a `'use client'` component.

### Pitfall 4: RLS Not Configured (Acceptable Here, Must Stay That Way)

**What goes wrong:** The service role key bypasses Row Level Security (RLS) entirely. If code is accidentally moved to the client, RLS provides zero protection.

**Why it's acceptable:** The project explicitly chose server-side-only queries with no RLS dependency. This is secure as long as the server-only boundary holds.

**How to maintain:** Keep `server-only` import in `lib/supabase/server.ts`. Never disable or remove it. Verify in CI that no client component imports from `lib/supabase/`.

### Pitfall 5: iron-session Password Length

**What goes wrong:** `SESSION_SECRET` shorter than 32 characters causes iron-session to throw an error at runtime.

**Why it happens:** iron-session uses the password for AES-256 encryption and enforces a minimum length.

**How to avoid:** Generate with `openssl rand -base64 32` and document the minimum length requirement in `.env.example`.

---

## Code Examples

Verified patterns from official sources:

### Supabase service role client with typed DB

```typescript
// lib/supabase/server.ts
// Source: https://github.com/orgs/supabase/discussions/30739 + Supabase docs
import 'server-only'
import { createClient as _createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createClient() {
  return _createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
```

### iron-session session module

```typescript
// lib/auth/session.ts
// Source: https://github.com/vvo/iron-session + Next.js 15 docs
import 'server-only'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface AdminSessionData {
  isLoggedIn: boolean
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'admin-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  },
}

export async function getSession() {
  const cookieStore = await cookies()  // Next.js 15: must await
  return getIronSession<AdminSessionData>(cookieStore, sessionOptions)
}

export async function createSession() {
  const session = await getSession()
  session.isLoggedIn = true
  await session.save()
}

export async function destroySession() {
  const session = await getSession()
  session.destroy()
}
```

### Resend email wrapper stub

```typescript
// lib/email/send.ts
// Source: https://resend.com/docs/send-with-nextjs
import 'server-only'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendEmailArgs {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  return resend.emails.send({
    from: 'Time Off System <noreply@yourdomain.com>',
    to,
    subject,
    html,
  })
}
```

### Next.js 15 `cookies()` correct usage

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/cookies
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()   // async in Next.js 15
  const theme = cookieStore.get('theme')
  return '...'
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cookies()` synchronous | `cookies()` async — must `await` | Next.js 15.0 RC | All session/cookie code needs `async/await` |
| `create-next-app@latest` → Next.js 15 | `create-next-app@latest` → Next.js 16 | October 2025 | Must pin to `@15` explicitly |
| `middleware.ts` | `proxy.ts` in Next.js 16 (middleware.ts deprecated) | Next.js 16 | Phase 1 uses Next.js 15, so `middleware.ts` is correct here |
| `@supabase/ssr` for all server usage | `@supabase/supabase-js` direct for service role | Always | SSR package is for user-auth flows, not service role |
| Synchronous params/searchParams | Async `await params`, `await searchParams` | Next.js 15 | Phase 1 doesn't use dynamic params, but Phase 2+ must follow this |

**Deprecated/outdated:**
- `next-iron-session` (older package name): Replaced by `iron-session` v8. Do not use the old package.
- Synchronous `cookies()` access: Works in Next.js 15 with a deprecation warning, removed in Next.js 16. Use async from the start.

---

## Open Questions

1. **Supabase project setup sequence**
   - What we know: Schema needs to be applied to a Supabase project (via dashboard SQL editor or Supabase CLI migrate)
   - What's unclear: Whether the user has a Supabase project created or needs to create one as part of Phase 1
   - Recommendation: Plan should include "create Supabase project and copy URL + service role key" as an explicit step before applying the migration

2. **Vercel project linkage**
   - What we know: Env vars must be added to Vercel project settings for production deploy to work
   - What's unclear: Whether the GitHub → Vercel integration is pre-configured
   - Recommendation: Include Vercel project creation and env var population as a plan step; treat it as required for the "deploys to Vercel" success criterion

3. **`SESSION_SECRET` naming**
   - What we know: iron-session requires a `password` option (min 32 chars)
   - What's unclear: The CONTEXT.md doesn't name this env var explicitly
   - Recommendation: Use `SESSION_SECRET` as the env var name; document in `.env.example`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — greenfield project |
| Config file | Wave 0 gap — no test framework installed yet |
| Quick run command | `npm test` (once framework is set up) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Supabase anon key never in browser bundle | smoke / build verification | `next build` — build fails if `server-only` import is violated | ❌ Wave 0 gap |
| SEC-02 | No `NEXT_PUBLIC_` prefix on secrets | manual / env audit | Grep check: `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY\|NEXT_PUBLIC_APPROVAL_SECRET\|NEXT_PUBLIC_ADMIN_PASSWORD" .` | ❌ manual |

**SEC-01 key insight:** The `server-only` package makes `next build` the test. If `lib/supabase/server.ts` is imported in a Client Component, the build errors out. No separate test file is needed for this — the build IS the test. Run `next build` as the phase gate check.

**SEC-02 key insight:** This is a configuration audit, not a runtime behavior. The test is: inspect `.env.local` and `.env.example` and confirm no secret var names begin with `NEXT_PUBLIC_`. A grep command is the automated check.

### Sampling Rate

- **Per task commit:** `next build` (verifies no server-only boundary violations)
- **Per wave merge:** `next build` + manual env audit
- **Phase gate:** `next build` completes with zero errors before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `next build` must pass — requires all stub files to have valid TypeScript (no `any` type errors if `strict: true`)
- [ ] `.env.example` — documents all required env var names (without values) so the env var audit has a reference
- [ ] No unit test framework needed in Phase 1 — Phase 1 only delivers stubs and schema. Behavioral tests belong to Phases 2–4.

---

## Sources

### Primary (HIGH confidence)

- [Next.js cookies() docs](https://nextjs.org/docs/app/api-reference/functions/cookies) — async cookies(), Next.js 15 API confirmed
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) — breaking changes vs 15, proxy.ts rename, Turbopack default
- [iron-session GitHub](https://github.com/vvo/iron-session) — v8 API, getIronSession with App Router
- npm registry — confirmed versions: iron-session@8.0.4, @supabase/supabase-js@2.99.0, resend@6.9.3, next@15.5.12 (latest 15.x), next@16.1.6 (latest overall)

### Secondary (MEDIUM confidence)

- [Supabase service role discussion](https://github.com/orgs/supabase/discussions/30739) — createClient config for service role (persistSession: false pattern)
- [Supabase enums docs](https://supabase.com/docs/guides/database/postgres/enums) — native enum migration pattern
- [Supabase TypeScript types](https://supabase.com/docs/guides/api/rest/generating-types) — gen types CLI command
- WebSearch findings on iron-session + Next.js 15 `await cookies()` — cross-verified with official Next.js docs

### Tertiary (LOW confidence)

- None — all critical claims verified against official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm registry live check
- Architecture: HIGH — locked by user in CONTEXT.md; no research ambiguity
- Pitfalls: HIGH — Next.js 16 version trap and `await cookies()` requirement confirmed via official Next.js docs
- iron-session patterns: MEDIUM-HIGH — confirmed v8 API from GitHub, cross-verified with WebSearch

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (30 days — Next.js 15.x is stable; iron-session v8 is stable)

**Critical note for planner:** `npx create-next-app@latest` installs Next.js 16 as of March 2026. The bootstrap task MUST use `npx create-next-app@15` or equivalent version-pinned command to honor the user's Next.js 15 decision.
