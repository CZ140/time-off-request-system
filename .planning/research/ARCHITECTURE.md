# Architecture Research

**Domain:** Teacher Time-Off Request System (Next.js 14 App Router + Supabase + Resend)
**Researched:** 2026-03-10
**Confidence:** HIGH — based on official Next.js and Supabase documentation plus verified community patterns

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER / EMAIL CLIENT                      │
├───────────────────┬──────────────────────┬──────────────────────────┤
│  Teacher (public) │  Admin (email link)   │  Admin (dashboard)       │
│  /  (form page)   │  /api/approve?token=  │  /admin  (cookie-auth)   │
└────────┬──────────┴──────────┬───────────┴──────────┬───────────────┘
         │                     │                       │
┌────────▼─────────────────────▼───────────────────────▼───────────────┐
│                        NEXT.JS APP (Vercel)                           │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  Page: /         │  │  Route Handler:  │  │  Pages: /admin/*     │ │
│  │  (Server Comp)  │  │  /api/approve    │  │  (Server Components) │ │
│  │  + Server Action│  │  (GET — external)│  │  + Server Actions    │ │
│  └────────┬────────┘  └────────┬─────────┘  └──────────┬───────────┘ │
│           │                    │                        │             │
│  ┌────────▼────────────────────▼────────────────────────▼───────────┐ │
│  │                     lib/ (shared logic)                          │ │
│  │   supabase/server.ts  |  email/send.ts  |  auth/session.ts       │ │
│  └────────┬────────────────────┬────────────────────────────────────┘ │
└───────────┼────────────────────┼─────────────────────────────────────┘
            │                    │
┌───────────▼──────┐   ┌─────────▼──────┐
│  Supabase Postgres│   │  Resend API    │
│  requests table   │   │  (email send)  │
│  blackout_dates   │   └────────────────┘
└───────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Public form page (`app/page.tsx`) | Render teacher submission form; call server action on submit | Server Component + `<form>` wired to Server Action |
| Submit Server Action (`app/actions/submit.ts`) | Validate form data, check blackout flag, write to DB, trigger email | `"use server"` function, called directly from form |
| Approval Route Handler (`app/api/approve/route.ts`) | Validate `APPROVAL_SECRET` token, update request status, send teacher confirmation email | `GET` route handler — external callers (email links) require this, not Server Actions |
| Admin login page (`app/admin/login/page.tsx`) | Accept password, set httpOnly cookie, redirect to dashboard | Server Component + Server Action for login |
| Admin dashboard (`app/admin/page.tsx`) | Show all requests in sortable table; manage blackout dates | Server Component; reads DB directly via server Supabase client |
| Admin Server Actions (`app/admin/actions.ts`) | Add/delete blackout dates, manual override of request status | `"use server"` functions — internal admin mutations |
| Middleware (`middleware.ts`) | Protect `/admin/*` routes by checking auth cookie; redirect unauthenticated users | `NextResponse` middleware, reads cookie without redirecting at data level |
| Supabase server client (`lib/supabase/server.ts`) | Shared factory — creates `@supabase/ssr` server client with `cookies()` | Used in Server Components, Route Handlers, and Server Actions |
| Email sender (`lib/email/send.ts`) | Wraps Resend SDK; encapsulates all `resend.emails.send()` calls | Plain async function returning `{error}` |
| Auth session util (`lib/auth/session.ts`) | Set/get/clear httpOnly admin cookie; validate cookie value against env var | Wraps `cookies()` API from `next/headers` |

## Recommended Project Structure

```
app/
├── page.tsx                    # Public form (Server Component)
├── success/
│   └── page.tsx                # Post-submission confirmation page
├── already-reviewed/
│   └── page.tsx                # Shown when approval link is re-clicked
├── api/
│   └── approve/
│       └── route.ts            # GET handler for tokenized approval/denial links
├── admin/
│   ├── layout.tsx              # Checks auth cookie; redirects to /admin/login if absent
│   ├── page.tsx                # Dashboard: all requests table (Server Component)
│   ├── login/
│   │   └── page.tsx            # Password form + login server action
│   └── blackout-dates/
│       └── page.tsx            # Blackout date management (optional sub-page)
├── actions/
│   └── submit.ts               # "use server" — teacher form submission
│   └── admin.ts                # "use server" — admin mutations (blackout CRUD, overrides)
└── layout.tsx                  # Root layout (Tailwind, fonts)

lib/
├── supabase/
│   └── server.ts               # createServerClient factory (used everywhere server-side)
├── email/
│   └── send.ts                 # Resend wrapper; all email sending goes here
│   └── templates/              # HTML string templates (auto-deny, approve, deny, admin notify)
├── auth/
│   └── session.ts              # httpOnly cookie helpers: set, get, clear, validate
└── types.ts                    # Shared TypeScript types (Request, BlackoutDate, LeafType enum)

middleware.ts                   # Route protection for /admin/*
```

### Structure Rationale

- **`app/actions/`:** Separating server actions from page files keeps pages thin and actions testable. Co-locating all mutations in one place also avoids the "server action buried in a component file" trap that makes code hard to find.
- **`lib/supabase/server.ts`:** Single factory file means cookie handling is done once. Every server-side caller imports from here — no duplicated `createServerClient` calls.
- **`lib/email/`:** Wrapping Resend in one module means the rest of the app never imports the SDK directly. If email provider changes, only this file changes.
- **`app/api/approve/`:** This is a Route Handler (not a Server Action) because the caller is an email client, not your React app. Email clients follow HTTP redirects on GET — Server Actions require POST.
- **`middleware.ts`:** Only handles redirect logic for `/admin/*`. Security verification of cookie value also happens inside the admin layout/pages — middleware alone is not sufficient (see PITFALLS.md on CVE-2025-29927).

## Architectural Patterns

### Pattern 1: Server Action for Form Submission

**What:** The teacher form POSTs to a Server Action instead of an API route. The action validates, writes to Supabase, sends email, then redirects.
**When to use:** Any form submission originating from your own React UI. No fetch() boilerplate needed.
**Trade-offs:** Simpler code, automatic CSRF protection, no manual JSON parsing. Cannot be called by external clients.

**Example:**
```typescript
// app/actions/submit.ts
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendAdminNotification, sendAutoDenyEmail } from "@/lib/email/send";

export async function submitRequest(formData: FormData) {
  const supabase = createClient();
  const isBlackout = formData.get("blackout_flag") === "true";

  const { data, error } = await supabase
    .from("requests")
    .insert({ /* fields from formData */ })
    .select()
    .single();

  if (error) throw error;

  if (isBlackout) {
    await supabase
      .from("requests")
      .update({ status: "denied" })
      .eq("id", data.id);
    await sendAutoDenyEmail(data);
  } else {
    await sendAdminNotification(data);
  }

  redirect("/success");
}
```

### Pattern 2: Route Handler for Tokenized Approval

**What:** Admin approval/denial happens via a GET request from an email link. A Route Handler validates the shared `APPROVAL_SECRET` token in the query param, updates the request status, sends the teacher confirmation email, and redirects to a result page.
**When to use:** The caller is an email client, not your React app. Email links are GET requests — Server Actions cannot be used here.
**Trade-offs:** Requires Route Handler boilerplate (NextResponse). GET-on-mutation is acceptable here because the URL is secret (token-protected) and the action is idempotent by design.

**Example:**
```typescript
// app/api/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTeacherConfirmation } from "@/lib/email/send";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  const requestId = searchParams.get("id");
  const action = searchParams.get("action"); // "approve" | "deny"

  if (token !== process.env.APPROVAL_SECRET) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("requests")
    .select("status")
    .eq("id", requestId)
    .single();

  if (existing?.status !== "pending") {
    return NextResponse.redirect(new URL("/already-reviewed", request.url));
  }

  await supabase
    .from("requests")
    .update({ status: action === "approve" ? "approved" : "denied" })
    .eq("id", requestId);

  await sendTeacherConfirmation(requestId, action);

  return NextResponse.redirect(new URL(`/approved?action=${action}`, request.url));
}
```

### Pattern 3: httpOnly Cookie Admin Session

**What:** Admin login validates a password against `ADMIN_PASSWORD` env var. On success, a signed value (or a simple constant secret) is stored in an httpOnly cookie. Middleware checks for cookie presence; the admin layout re-validates the cookie value before rendering.
**When to use:** Simple password-only admin protection where NextAuth or Supabase Auth would be significant overkill.
**Trade-offs:** Simple to implement and audit. Not suitable if you ever need per-user admin accounts or fine-grained permissions. No session expiry built-in — add `Max-Age` to the cookie.

**Example:**
```typescript
// lib/auth/session.ts
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_VALUE = process.env.ADMIN_SESSION_SECRET!;

export function setAdminSession() {
  cookies().set(COOKIE_NAME, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/admin",
  });
}

export function isAdminAuthenticated(): boolean {
  return cookies().get(COOKIE_NAME)?.value === SESSION_VALUE;
}

export function clearAdminSession() {
  cookies().delete(COOKIE_NAME);
}
```

### Pattern 4: Supabase Server Client Factory

**What:** A single `lib/supabase/server.ts` file exports a `createClient()` function that wires `@supabase/ssr`'s `createServerClient` to Next.js `cookies()`. Every server-side caller imports from here.
**When to use:** Always — never instantiate `createServerClient` inline in a page or route handler.
**Trade-offs:** One extra import. The alternative (inline instantiation everywhere) leads to duplicated cookie handling and cookie read/write bugs.

**Example:**
```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

Note: This project does not use Supabase Auth for users. The `createServerClient` is used purely for Postgres data access. The cookie wiring is required by the package but will not be actively writing auth session cookies in this app.

## Data Flow

### Flow 1: Teacher Submits Request

```
Teacher fills form (browser)
    ↓
<form action={submitRequest}> triggers Server Action (POST, same origin)
    ↓
submitRequest() — runs on server
    ↓ validate formData
    ↓ createClient() → INSERT into supabase.requests
    ↓ check blackout_flag
    ├── blackout=true  → UPDATE status="denied" → sendAutoDenyEmail(teacher)
    └── blackout=false → sendAdminNotification(all admins with Approve/Deny links)
    ↓
redirect("/success")
```

### Flow 2: Admin Approves/Denies via Email Link

```
Admin receives email with link:
  /api/approve?token=SECRET&id=UUID&action=approve
    ↓
Email client follows GET link → Route Handler
    ↓
Validate token === process.env.APPROVAL_SECRET
    ↓ invalid → redirect /unauthorized
    ↓ valid
    ↓
SELECT status FROM requests WHERE id=UUID
    ↓ status !== "pending" → redirect /already-reviewed
    ↓ status = "pending"
    ↓
UPDATE requests SET status="approved"|"denied" WHERE id=UUID
    ↓
sendTeacherConfirmation(teacher_email, action)
    ↓
redirect /approved?action=approve  (friendly result page)
```

### Flow 3: Admin Dashboard Access

```
Browser navigates to /admin
    ↓
middleware.ts checks for admin_session cookie
    ↓ absent → redirect /admin/login
    ↓ present (not yet validated)
    ↓
app/admin/layout.tsx calls isAdminAuthenticated()
    ↓ value mismatch → redirect /admin/login  (double-check — middleware bypass defense)
    ↓ valid
    ↓
app/admin/page.tsx (Server Component)
    ↓ createClient() → SELECT * FROM requests ORDER BY created_at DESC
    ↓ render table (Server Component, no client-side fetch)
```

### Flow 4: Admin Manages Blackout Dates

```
Admin fills "Add Blackout Date" form on dashboard
    ↓
Server Action: addBlackoutDate(formData)
    ↓ INSERT into blackout_dates
    ↓ revalidatePath("/admin")
    ↓ (no redirect — stay on dashboard; page refreshes from cache invalidation)
```

## Suggested Build Order

Build in dependency order — each phase unlocks the next:

1. **Database + Supabase client** — `lib/supabase/server.ts`, confirm table access, env vars wired
2. **Public form page + submit server action** — the core teacher-facing flow; no email yet, just DB write
3. **Email module (`lib/email/send.ts`)** — Resend SDK wrapper + HTML templates for all 3 email types
4. **Auto-deny logic** — add blackout check to submit action, send auto-deny email
5. **Admin notification email** — send approval/denial links to admins on non-blackout submission
6. **Approval Route Handler** — `/api/approve` — token validation, status update, teacher confirmation email
7. **Already-reviewed page** — simple static page; route handler redirects here on repeat clicks
8. **Admin auth** — `lib/auth/session.ts`, login page + action, middleware, admin layout guard
9. **Admin dashboard** — requests table, sortable/filterable (server-side or client-side sort)
10. **Blackout date management** — add/delete UI on dashboard + server actions

This order ensures the critical path (submit → email → approve → notify) is validated before building the admin UI layer.

## Anti-Patterns

### Anti-Pattern 1: Using a Server Action for the Approval Link

**What people do:** Try to use a Server Action for the approve/deny action because it's "simpler."
**Why it's wrong:** Server Actions require POST requests. Email clients open links as GET requests. The action will never fire.
**Do this instead:** Use a Route Handler (`app/api/approve/route.ts`) that handles `GET`. This is the correct tool for externally-triggered HTTP endpoints.

### Anti-Pattern 2: Relying Solely on Middleware for Admin Auth

**What people do:** Check the cookie only in `middleware.ts` and assume protected routes are safe.
**Why it's wrong:** CVE-2025-29927 (disclosed 2025) demonstrated that Next.js middleware can be bypassed via crafted `x-middleware-subrequest` headers in older versions. Even after patching, defense-in-depth requires verifying auth at the data access layer too.
**Do this instead:** Middleware handles redirect UX (fast, user-facing). Admin layout and server actions re-validate `isAdminAuthenticated()` before touching any data. Two checks, two layers.

### Anti-Pattern 3: Calling `createServerClient` Inline

**What people do:** Copy-paste the `createServerClient(url, key, { cookies: ... })` block into each page, route handler, and server action that needs DB access.
**Why it's wrong:** Cookie handling is duplicated across files. When the pattern changes (e.g., Supabase updates the SSR package), every copy must be updated. Bugs become inconsistent across files.
**Do this instead:** Single factory in `lib/supabase/server.ts`. All server-side code calls `createClient()` from that one import.

### Anti-Pattern 4: Sending Email Inside a try/catch with redirect

**What people do:** Put `sendEmail()` and `redirect()` inside the same try block.
**Why it's wrong:** `redirect()` throws a special Next.js control-flow error. `catch` will catch it and swallow it, preventing the redirect from executing.
**Do this instead:** Call `redirect()` outside of any `try/catch`. Pattern: `try { await doWork(); } catch(e) { handleError(e); } redirect('/success');`

### Anti-Pattern 5: Storing Admin Password Directly in Cookie

**What people do:** Set the cookie value to the admin password string itself.
**Why it's wrong:** The cookie value is visible to anyone with access to the browser. If the password is the cookie value, rotating the password requires clearing all sessions.
**Do this instead:** Store a separate `ADMIN_SESSION_SECRET` env var as the cookie value. The password is used only at login to gate setting this cookie. The cookie value is an opaque secret, not the password.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres | `@supabase/ssr` `createServerClient` from `lib/supabase/server.ts` | Anon key used; RLS policies should restrict access to service role if no auth. For this app with no user auth, consider service role key server-side only |
| Resend API | `resend.emails.send()` wrapped in `lib/email/send.ts` | API key is server-only env var; never exposed to browser. Sending domain must be DNS-verified before deployment |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Page/Component → Server Action | Direct function call via form `action` prop or `startTransition` | Type-safe, no fetch boilerplate |
| Route Handler → Supabase | `createClient()` from `lib/supabase/server.ts` | Same factory as pages/actions |
| Server Action → Email | `await sendX()` from `lib/email/send.ts` | Email is side-effect; run after DB write succeeds |
| Middleware → Admin Pages | Cookie presence check only; layout does value validation | Two-layer auth defense |
| Admin layout → Auth util | `isAdminAuthenticated()` from `lib/auth/session.ts` | Validates cookie value matches `ADMIN_SESSION_SECRET` |

## Scaling Considerations

This is a small internal tool. Scaling is not a concern. The architecture is intentionally simple.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 submissions/year | Current design is sufficient; Vercel hobby tier handles it |
| 500-10K submissions/year | No changes needed; Supabase free tier handles the DB load |
| 10K+ submissions/year | This would be an unusual volume for a school — no realistic scenario requires changes |

### Practical limits to watch

- **Resend free tier:** 3,000 emails/month. A school submitting 100 requests/month generates ~300-400 emails (submit confirmation + admin notify + teacher outcome). Free tier is fine.
- **Supabase free tier:** 500MB DB, 2GB bandwidth. This app will use a fraction of that indefinitely.
- **Vercel Hobby:** Serverless function timeout is 10s. Email sends via Resend are fast (<1s). No risk.

## Sources

- [Next.js Route Handlers — Official Docs](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Server Actions — Official Docs](https://nextjs.org/docs/app/getting-started/updating-data)
- [Server Actions vs Route Handlers — MakerKit](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers)
- [Creating a Supabase Client for SSR — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Next.js cookies() API — Official Docs](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Next.js redirect() — Official Docs](https://nextjs.org/docs/app/api-reference/functions/redirect)
- [Next.js revalidatePath() — Official Docs](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Send emails with Next.js — Resend Docs](https://resend.com/docs/send-with-nextjs)
- [Common Mistakes with Next.js App Router — Vercel Blog](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them)

---
*Architecture research for: Teacher Time-Off Request System*
*Researched: 2026-03-10*
