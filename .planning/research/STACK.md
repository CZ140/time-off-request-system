# Stack Research

**Domain:** Teacher Time-Off Request System (Next.js App Router, Supabase, Resend, Tailwind CSS)
**Researched:** 2026-03-10
**Confidence:** HIGH (all major stack choices verified against official docs and current releases)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (latest stable) | Full-stack React framework | Next.js 15 is current stable. The project spec says "14" but 15 is a drop-in upgrade via codemod — see Note below. All App Router patterns apply equally. |
| React | 19.x | UI rendering | Required peer dependency for Next.js 15. Provides `useActionState` (replaces deprecated `useFormState`) for server action form state. |
| TypeScript | 5.x | Type safety | Ships with `create-next-app`; catches Supabase row type mismatches and server action payload errors at compile time. |
| Supabase (`@supabase/supabase-js`) | 2.99.x | Postgres database client (queries, RLS, typed responses) | Official JS client. Only package needed for querying. |
| Supabase SSR (`@supabase/ssr`) | 0.9.x | Cookie-aware Supabase clients for server components and middleware | Replaces deprecated `@supabase/auth-helpers-*`. Required for reading/writing cookies in server components, server actions, and middleware in App Router. |
| Resend | 6.9.x | Transactional email delivery | First-class Next.js App Router support. Simple API: one SDK call from any server context. No SMTP configuration needed. |
| Tailwind CSS | 4.x | Utility-first CSS | Current stable (released Jan 2025). CSS-first config (`@import "tailwindcss"` replaces `@tailwind` directives). Faster builds via Oxide engine. |

> **Note on Next.js version:** The project spec says "Next.js 14" but Next.js 15 is current stable and has been since late 2024. The stack is fully specified as fixed, so if 14 is a hard constraint, all patterns documented here still apply — only the `cookies()` and `headers()` APIs differ (synchronous in 14, async in 15). This document targets 15 as the build recommendation. If starting greenfield today, use 15.

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `iron-session` | 8.x | Stateless, encrypted cookie sessions | Admin password authentication. Encrypts session data into a signed httpOnly cookie. No database table required. Use instead of rolling a custom JWT. |
| `@tailwindcss/forms` | 0.5.11 | Base CSS reset for form elements | Apply to the teacher request form and admin login. Makes `<input>`, `<select>`, `<textarea>` overridable with Tailwind utilities. Works with Tailwind v4 via `@plugin "@tailwindcss/forms"` in CSS. Minor CSS ordering bug in v4 for multi-select — not relevant to this project. |
| `@tailwindcss/postcss` | 4.x | PostCSS integration for Tailwind v4 | Required when using Tailwind v4 with Next.js (which uses PostCSS). Add to `postcss.config.js`. |
| `zod` | 3.x | Runtime schema validation | Validate teacher form submissions and admin action payloads in server actions. Prevents malformed data from reaching Supabase. |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vercel CLI | Local dev that matches Vercel production environment | `npx vercel dev` runs the project with Vercel's edge runtime and env var loading. Catches environment issues before deploy. |
| Supabase CLI | Run local Postgres for development | `supabase start` spins up a local Postgres + Studio. Avoids hitting production DB during development. Optional — can use hosted dev project instead. |
| ESLint (`eslint-config-next`) | Lint Next.js-specific patterns | Ships with `create-next-app`. Catches missing `"use client"` directives, incorrect server action usage. |

---

## Key Integration Patterns

### Pattern 1: Supabase Client Setup (Server vs Browser)

Two clients are required. Never use the browser client on the server or vice versa.

**Browser client** — for Client Components only (`lib/supabase/client.ts`):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

**Server client** — for Server Components, Server Actions, and Route Handlers (`lib/supabase/server.ts`):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()  // await required in Next.js 15
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // Server Components can't write cookies; middleware handles refresh
        },
      },
    }
  )
}
```

**Why two clients:** Server Components cannot write cookies. The `@supabase/ssr` package handles token refresh via middleware. If you use the browser client in a server context, environment variables are exposed client-side and session tokens don't refresh correctly.

---

### Pattern 2: Server Actions vs Route Handlers

**Use Server Actions for:**
- Teacher form submission (bound to a React `<form>`)
- Admin login (password check + cookie set)
- Blackout date add/delete from admin dashboard

**Use Route Handlers for:**
- Tokenized approval/denial links (`/api/approve?token=...&action=approve`) — these are accessed via email link click, making them external GET requests, not form submissions
- Any endpoint an external service needs to call

**Rule of thumb:** If a user triggers it by clicking a button in the UI, use a Server Action. If a link in an email or an external service triggers it, use a Route Handler.

---

### Pattern 3: Admin Cookie Auth (no NextAuth)

Use `iron-session` for the admin password session. This avoids NextAuth's OAuth complexity for a single shared password scenario.

Flow:
1. Admin submits password to a Server Action
2. Server Action compares to `process.env.ADMIN_PASSWORD`
3. On match: create an `iron-session` cookie with `{ admin: true }`
4. Middleware reads cookie and redirects unauthenticated requests away from `/admin/*`

The cookie is httpOnly, signed, and encrypted by `iron-session` — no raw password or token is stored in the cookie.

---

### Pattern 4: Sending Email with Resend

Resend works identically from Server Actions and Route Handlers. For approval/denial links (Route Handlers), use this pattern:

```typescript
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

// Inside a Server Action or Route Handler:
const { data, error } = await resend.emails.send({
  from: 'School Admin <no-reply@yourdomain.com>',
  to: teacherEmail,
  subject: 'Your time-off request has been received',
  html: buildEmailHtml({ ... }),  // raw HTML string — no React Email needed
})

if (error) {
  // log and surface appropriate error
}
```

**HTML over React Email:** The project decision to use raw HTML templates is correct for this use case. React Email adds a dependency and build step for no benefit when the templates are simple notification emails. Build HTML strings in a `lib/emails/` folder with plain TypeScript template functions.

---

### Pattern 5: Tailwind v4 Form Styling

Tailwind v4 installation in Next.js (PostCSS path, not Vite):

```bash
npm install tailwindcss @tailwindcss/postcss @tailwindcss/forms
```

`postcss.config.js`:
```javascript
export default {
  plugins: { "@tailwindcss/postcss": {} }
}
```

`app/globals.css`:
```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";
```

No `tailwind.config.js` required in v4 — all configuration moves to CSS via `@theme`. Custom design tokens (colors, spacing) go in the CSS file under `@theme {}`.

---

## Installation

```bash
# Core framework (answer yes to TypeScript, Tailwind, App Router, src/ dir: no)
npx create-next-app@latest time-off-request --typescript --tailwind --app --no-src-dir

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Email
npm install resend

# Admin session
npm install iron-session

# Validation
npm install zod

# Tailwind v4 additions (create-next-app may install v3; upgrade if needed)
npm install tailwindcss@latest @tailwindcss/postcss @tailwindcss/forms
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `iron-session` for admin auth | NextAuth.js | When you need OAuth providers, multiple user accounts, or JWT rotation. Overkill for a single shared password. |
| `iron-session` for admin auth | Custom JWT with `jose` | When you need fine-grained JWT claims or cross-service token validation. More setup for equivalent result here. |
| Raw HTML email templates | React Email + `@react-email/components` | When you have complex, component-driven email layouts that need reuse. Adds a dependency and JSX compilation step. |
| Resend | SendGrid / Postmark / AWS SES | When you already have an account with another provider or need advanced deliverability features. Resend has the simplest DX for new projects. |
| Tailwind CSS v4 | Tailwind CSS v3.4 | If you need to support IE11 or pre-2022 browsers, or if your PostCSS pipeline has compatibility issues. v3 is still actively maintained. |
| Supabase Postgres | PlanetScale / Neon / Railway | If the operator already has a different cloud database. Supabase is chosen here; do not substitute without changing the client library. |
| Vercel | Railway / Fly.io / Render | For non-Vercel deployments. Route Handler and middleware behavior is the same; environment variable setup differs. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated. No longer receives bug fixes or features. Will break on future Next.js updates. | `@supabase/ssr` |
| `createClient` from `@supabase/supabase-js` directly in server components | Doesn't handle cookie-based session refresh; tokens expire silently. | `createServerClient` from `@supabase/ssr` |
| NextAuth.js | Massive overhead for a simple shared-password admin. Pulls in OAuth flows, database adapters, and session tables that are completely unnecessary. | `iron-session` |
| Pages Router API routes (`pages/api/`) | Inconsistent with App Router patterns; `cookies()` and `headers()` APIs differ; can't use `"use server"` actions. | App Router Route Handlers (`app/api/.../route.ts`) |
| `useFormState` (React 18 / Next.js 14 API) | Deprecated in React 19 / Next.js 15. | `useActionState` from `react` |
| Prisma ORM | Unnecessary abstraction over Supabase's typed JS client. Supabase auto-generates TypeScript types from your schema. Adds a migration tool that conflicts with Supabase migrations. | `@supabase/supabase-js` directly |
| `cookies()` called synchronously in server components | Breaking change in Next.js 15 — must be awaited. Will throw in production builds. | `await cookies()` |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next@15.x` | `react@19.x`, `react-dom@19.x` | React 19 is required peer dependency for Next.js 15. |
| `@supabase/ssr@0.9.x` | `@supabase/supabase-js@2.x` | Both must be from the `@supabase` v2 series. |
| `tailwindcss@4.x` | `@tailwindcss/postcss@4.x` | PostCSS plugin must match Tailwind major version. |
| `tailwindcss@4.x` | `@tailwindcss/forms@0.5.11` | Forms plugin works with v4 via `@plugin` directive. Known minor CSS ordering issue with multi-select — not applicable to this project. |
| `iron-session@8.x` | `next@15.x` | iron-session v8 uses the Web Crypto API natively; no Node.js polyfills needed. Compatible with Edge Runtime. |
| `resend@6.x` | `next@14.x` and `next@15.x` | Resend is a plain HTTP client; no framework-specific compatibility concerns. |

---

## Environment Variables

Required in `.env.local` (never commit to git):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Admin auth
ADMIN_PASSWORD=your-secure-admin-password
ADMIN_EMAILS=admin1@school.edu,admin2@school.edu

# Approval flow
APPROVAL_SECRET=your-random-secret-string

# App URL (used to build approval links in emails)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# iron-session
SESSION_SECRET=a-random-32-character-secret-string
```

Set all of these in Vercel's dashboard under Project > Settings > Environment Variables.

---

## Sources

- [Supabase: Creating a client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — server client patterns, cookie handling, `@supabase/ssr` vs `@supabase/auth-helpers` — HIGH confidence
- [Supabase: Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — package names, middleware pattern — HIGH confidence
- [Resend: Send emails with Next.js](https://resend.com/docs/send-with-nextjs) — route handler pattern, SDK usage — HIGH confidence
- [Tailwind CSS v4.0 release blog](https://tailwindcss.com/blog/tailwindcss-v4) — v4 installation, PostCSS plugin, CSS-first config — HIGH confidence
- [Next.js: Upgrading to version 15](https://nextjs.org/docs/app/guides/upgrading/version-15) — breaking changes in `cookies()`, `headers()`, async APIs, caching defaults — HIGH confidence
- [GitHub: tailwindlabs/tailwindcss-forms](https://github.com/tailwindlabs/tailwindcss-forms) — v4 compatibility status, `@plugin` directive — MEDIUM confidence (GitHub discussion, not official docs)
- WebSearch: `@supabase/ssr` v0.9.x, `@supabase/supabase-js` v2.99.x, `resend` v6.9.x — version numbers current as of 2026-03-10 — MEDIUM confidence (npm search result, not official changelog)
- [Next.js: Authentication guide](https://nextjs.org/docs/app/guides/authentication) — httpOnly cookie session pattern recommendation — HIGH confidence
- [makerkit.dev: Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — decision framework for when to use each — MEDIUM confidence (third-party, well-regarded source)

---
*Stack research for: Teacher Time-Off Request System*
*Researched: 2026-03-10*
