# Pitfalls Research

**Domain:** Email-workflow approval system (Next.js 14 App Router + Supabase + Resend)
**Researched:** 2026-03-10
**Confidence:** HIGH (stack-specific, verified via official docs and community issue trackers)

---

## Critical Pitfalls

### Pitfall 1: Using the Wrong Supabase Client in the Wrong Context

**What goes wrong:**
`createServerClient` (from `@supabase/ssr`) imports `cookies` from `next/headers`, which is only valid in server context. If you import it into a Client Component or any file tagged `"use client"`, the build fails or throws a runtime error. Conversely, using `createBrowserClient` in a Server Component or Route Handler means cookies are not forwarded, so auth state is invisible to the server.

**Why it happens:**
Tutorial code often shows a single `supabase.ts` utility file. Developers copy it everywhere without distinguishing server vs. client context. The App Router mixes server and client files in the same directory, making the boundary non-obvious.

**How to avoid:**
Create two separate utility files from the start:
- `lib/supabase/server.ts` — exports a function that calls `createServerClient` with `cookies()` from `next/headers`. Used in Server Components, Route Handlers, and Server Actions only.
- `lib/supabase/client.ts` — exports a singleton that calls `createBrowserClient`. Used only in `"use client"` components.

Never import `server.ts` into any file with `"use client"`. Never import `client.ts` into Route Handlers.

**Warning signs:**
- Build error: `You're importing a component that needs next/headers`
- `AuthSessionMissingError` thrown in an API Route despite valid cookie in request headers
- Session visible in browser DevTools but undefined on server

**Phase to address:** Foundation / Project setup (before writing any feature code)

---

### Pitfall 2: Relying on Middleware Alone for Admin Auth (CVE-2025-29927)

**What goes wrong:**
CVE-2025-29927 (CVSS 9.1, disclosed March 2025) allows an attacker to add the header `x-middleware-subrequest` to any request, causing Next.js middleware to skip execution entirely. Any admin dashboard route protected only by a middleware cookie check is fully bypassed with a single header injection.

**Why it happens:**
Middleware is the obvious place to centralize auth checks — it intercepts all requests before they hit route handlers. Developers treat it as sufficient and skip in-handler verification.

**How to avoid:**
Add an auth check inside every admin Route Handler and Server Action, in addition to middleware. The middleware acts as a first-pass UX redirect (sends unauthenticated users to the login page); the Route Handler check is the actual security gate. Vercel-hosted apps receive automatic patching, but defense-in-depth should not depend on the host.

Concretely: in every `/api/admin/**` route handler, verify the session cookie value matches `ADMIN_PASSWORD_HASH` before processing the request. Return 401 if it does not.

**Warning signs:**
- Admin routes return data without a valid session cookie when tested via `curl -H "x-middleware-subrequest: ..."`
- No auth check exists inside individual route handlers — only in `middleware.ts`

**Phase to address:** Admin dashboard / Auth implementation phase

---

### Pitfall 3: Shared `APPROVAL_SECRET` Token Is Not One-Time-Use

**What goes wrong:**
The project design uses a single shared `APPROVAL_SECRET` in query params for all approval links (e.g., `?token=SECRET&requestId=123&action=approve`). If an admin approves a request, the link remains valid indefinitely. Any party who ever received that email — or intercepted it — can replay the approval (or denial) action later. The token also cannot be revoked if a link is forwarded or email is compromised.

**Why it happens:**
A shared secret is simple to implement and avoids a token database table. The replay risk is non-obvious when the happy path is "admin clicks link once."

**How to avoid:**
Persist a `reviewed` boolean (or `status` field) on the `requests` table and check it before processing any approval action. If the request is already in a terminal state (`approved` / `denied`), return the "already reviewed" page immediately without re-applying the action. This does not eliminate replay risk but eliminates replay *effect* — a replayed link does nothing.

Additionally, validate that `requestId` in the query param actually exists in the database before acting. Never trust the token alone without correlating it to a specific request row.

**Warning signs:**
- Approval Route Handler does not query the database to check current `status` before updating it
- No "already reviewed" check — the action fires every time the link is opened
- `APPROVAL_SECRET` is the same string for every request every day

**Phase to address:** Email workflow / Approval token implementation phase

---

### Pitfall 4: `APPROVAL_SECRET` Exposed in Client-Side JavaScript

**What goes wrong:**
If `APPROVAL_SECRET` or `ADMIN_PASSWORD` is referenced in any Client Component or prefixed with `NEXT_PUBLIC_`, it will be inlined into the JavaScript bundle shipped to the browser. Any user who opens DevTools can read it and forge approval requests.

**Why it happens:**
Developers sometimes reach for environment variables in client-side form validation or UI logic without realizing the variable is now public. The `NEXT_PUBLIC_` prefix requirement makes it explicit, but accidentally passing the secret as a prop from a Server Component to a Client Component has the same effect.

**How to avoid:**
- `APPROVAL_SECRET`, `ADMIN_PASSWORD`, and `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed with `NEXT_PUBLIC_`
- These values must only be referenced inside Server Components, Route Handlers, or Server Actions
- Validate in CI: `grep -r "NEXT_PUBLIC_APPROVAL" .` should return no results

**Warning signs:**
- Any of these variable names appear in `NEXT_PUBLIC_*` form in `.env` or Vercel dashboard
- The values appear in the browser network tab response bodies or JavaScript bundles
- A Client Component imports `process.env.APPROVAL_SECRET` directly

**Phase to address:** Foundation / Project setup — enforce as a naming convention from day one

---

### Pitfall 5: Supabase RLS Disabled on Public Tables

**What goes wrong:**
Supabase's `anon` key is safe to expose in the browser *only if* Row Level Security (RLS) is enabled on all tables. If RLS is off (the default when creating tables via SQL), anyone who can find the anon key (it is publicly visible in the JavaScript bundle) can `SELECT *` your entire `requests` table — including teacher names, emails, and leave reasons.

**Why it happens:**
The Supabase dashboard warns about missing RLS when using the table editor UI, but there is no warning when creating tables via raw SQL migrations. Developers focus on getting the schema right and forget to enable RLS.

**How to avoid:**
Since this project's Supabase client is only used server-side (all queries go through Route Handlers and Server Actions using the service role key or server client), you have two safe options:
1. Enable RLS on both tables and write policies that only allow the service role key
2. Or, never expose the Supabase anon key to the browser at all — keep it exclusively server-side and rely on the service role key with RLS enabled

Option 2 is simpler for this project's architecture. Audit that no Supabase client is instantiated in any `"use client"` component.

**Warning signs:**
- Supabase dashboard "Database Linter" flags `rls_disabled_in_public`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set and used in a browser-side client
- The `requests` table is readable without any session from a direct Supabase REST API call

**Phase to address:** Foundation / Database setup phase

---

### Pitfall 6: Cookies Not Set Correctly in Admin Login Route Handler

**What goes wrong:**
In the App Router, cookies can only be *set* in Route Handlers, Server Actions, and Middleware — not in Server Components. A common mistake is attempting to set the session cookie in a Server Component after form submission, which silently does nothing (the component renders but the cookie write is dropped). The admin session appears to succeed but the next request is unauthenticated.

A related issue: setting the cookie without `httpOnly: true`, `secure: true`, and `sameSite: 'lax'` leaves the session vulnerable to XSS theft or cross-site request forgery.

**Why it happens:**
The App Router's hybrid nature (Server Components look like request handlers but are not) confuses the mental model. Developers new to the App Router conflate rendering with handling.

**How to avoid:**
Handle admin login via a Route Handler (`app/api/admin/login/route.ts`) that:
1. Validates the submitted password against `process.env.ADMIN_PASSWORD`
2. Sets a response cookie with `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, and a reasonable `maxAge`
3. Returns a redirect to the dashboard

Alternatively, use a Server Action that calls `cookies().set(...)` — Server Actions support cookie writes.

**Warning signs:**
- Admin login form submits successfully but next page load shows "not authenticated"
- Cookie is not visible in browser DevTools → Application → Cookies after login
- Cookie is set but without `HttpOnly` flag (visible in JS via `document.cookie`)

**Phase to address:** Admin dashboard / Auth implementation phase

---

### Pitfall 7: Email Sent Before Database Write Commits (Race Condition)

**What goes wrong:**
A form submission handler writes the request to Supabase and then immediately sends an email via Resend. If the Supabase insert fails silently (network error, constraint violation) but the email send is already underway, teachers receive a confirmation for a request that was never actually saved. The reverse is also possible: the insert succeeds but the Resend call fails, so the admin never receives the notification.

**Why it happens:**
Sequential async calls without checking intermediate results. Developers treat both operations as fire-and-forget.

**How to avoid:**
Structure the handler with strict sequential error checking:
1. Insert into Supabase — if error, return failure response immediately, do not call Resend
2. Call Resend — if error, log the error and consider whether to surface it to the user or retry
3. Return success only if both completed without error

For the admin notification email specifically, a failed send is not fatal (the request is saved; the admin can view it in the dashboard). Log the Resend error but do not roll back the database insert. For teacher confirmation emails, same pattern applies.

**Warning signs:**
- No `if (error) return` guard after the Supabase insert call
- Resend is called with `await` but the result is never checked for `error`
- Teachers report getting confirmation emails for requests they cannot find in the admin dashboard

**Phase to address:** Form submission / Email workflow implementation phase

---

### Pitfall 8: Double Form Submission (No Pending State)

**What goes wrong:**
The public teacher submission form has no loading state. A teacher clicks "Submit" and, seeing no feedback, clicks again. Two identical requests are inserted into the database. Both trigger admin notification emails. The admin sees duplicate entries, approves one, and the other stays pending forever.

**Why it happens:**
Forms without explicit pending state management allow repeated submissions. Network latency between click and server response creates the window.

**How to avoid:**
Use `useFormStatus` (React 19 / Next.js 14) or manually track a `pending` boolean in component state. Disable the submit button immediately on first click and show a spinner. Only re-enable on explicit error (not on success — success redirects away).

If using a Server Action, `useActionState` provides a pending flag natively.

**Warning signs:**
- Submit button is not disabled during the in-flight request
- No loading indicator between submit click and redirect/error display
- Database occasionally contains exact duplicate rows with the same teacher email and dates

**Phase to address:** Form submission implementation phase

---

### Pitfall 9: Approval Link `requestId` Is Not Validated Against the Database

**What goes wrong:**
The approval URL contains both `?token=SECRET&requestId=123&action=approve`. If the handler only checks the token and blindly trusts `requestId`, an attacker who obtains the shared secret (e.g., forwarded email) can craft a URL with any arbitrary `requestId` and approve or deny any request — including ones that were never sent to them.

**Why it happens:**
Developers validate the token and assume that is sufficient. The `requestId` is treated as trusted data once the token passes.

**How to avoid:**
After validating `APPROVAL_SECRET`, query the database for the specific `requestId`. Confirm the row exists and is in `pending` status before applying the action. This ensures the token + a valid pending request ID are both required for the action to proceed.

**Warning signs:**
- Route Handler applies the database update using only the query-param `requestId` without fetching the row first
- No check that the row's `status` is `pending` before updating it

**Phase to address:** Email workflow / Approval token implementation phase

---

### Pitfall 10: Resend Sending from Unverified Domain Goes to Spam

**What goes wrong:**
Resend requires DNS records (SPF, DKIM via CNAME) to be verified for the sending domain. If the operator deploys the app without completing DNS verification, emails either bounce, are silently dropped, or land in spam — with no obvious error in the application code (Resend returns 200 but deliverability is zero).

**Why it happens:**
DNS propagation takes up to 72 hours. Developers test with Resend's sandbox or a personal email during development, then forget to complete production domain verification before launch.

**How to avoid:**
- Add a Resend domain verification step as an explicit pre-launch checklist item
- Use Resend's domain verification API to programmatically check status at app startup (or in a health-check route) and log a warning if unverified
- Ensure the `from` address in all `resend.emails.send()` calls uses the verified domain, not a random address
- The `from` domain must match the verified sending domain — mismatched `from` addresses bypass DKIM even if the domain is verified

**Warning signs:**
- Resend dashboard shows domain status as "Pending" or "Not verified"
- Resend returns success (200) but emails do not appear in recipient inboxes
- `from` field uses a different subdomain than what was verified in Resend dashboard

**Phase to address:** Email infrastructure setup — before any feature that sends email

---

### Pitfall 11: Supabase `@supabase/auth-helpers` Package (Deprecated)

**What goes wrong:**
Many tutorials and Stack Overflow answers reference `@supabase/auth-helpers-nextjs`. This package is deprecated and no longer receives bug fixes. Using it with Next.js 14 App Router produces a range of cookie and session bugs that are fixed in `@supabase/ssr` but not backported to the old package.

**Why it happens:**
The package name is intuitive and dominates older search results. Copy-pasting from tutorials written before mid-2023 silently pulls in the deprecated package.

**How to avoid:**
Use only `@supabase/ssr` and `@supabase/supabase-js`. Do not install `@supabase/auth-helpers-nextjs`. If it appears in `package.json`, remove it.

**Warning signs:**
- `package.json` contains `@supabase/auth-helpers-nextjs`
- Cookie errors or `AuthSessionMissingError` that do not reproduce when reproducing the same flow in official Supabase SSR docs examples

**Phase to address:** Foundation / Dependency installation phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Plain-text password comparison for admin auth | No crypto dependency | Password exposed in timing attacks; no upgrade path to hashed passwords | Never — use `crypto.timingSafeEqual` from the Node.js built-in |
| Single `supabase.ts` client used everywhere | Simpler file structure | Build errors or auth failures when imported into wrong context | Never in App Router |
| No idempotency key on Resend calls | Simpler code | Duplicate emails on retry (e.g., from a deployment restart mid-request) | Acceptable for MVP if form has double-submit protection |
| Skipping "already reviewed" database check | Fewer DB queries per approval click | Approval action fires on every link click; replays overwrite previous decisions | Never |
| Storing `ADMIN_PASSWORD` in plain text in env | Simple to set up | Fine as-is for this use case — env vars are not visible to users | Acceptable given the project's simple auth model |
| HTML email templates inline in route handler | No template system needed | Templates become unmaintainable at 5+ email types | Acceptable for MVP with 3-4 email types |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase SSR | Calling `supabase.auth.getSession()` server-side | Always use `supabase.auth.getUser()` server-side — `getSession()` does not validate the JWT |
| Supabase SSR | Creating a new `createServerClient` instance per-module | Create it inside a helper function called per-request (not a module-level singleton) — cookies must be read fresh per request |
| Resend | Using `from: "noreply@gmail.com"` or any domain you do not own | `from` must use the domain verified in Resend dashboard — mismatched domains fail DKIM |
| Resend | Firing `resend.emails.send()` without awaiting the result | Always `await` and check for `error` in the returned object — Resend SDK returns `{ data, error }`, not a thrown exception |
| Next.js cookies | Setting cookies in a Server Component | Cookies can only be set in Route Handlers, Server Actions, or Middleware — Server Components are read-only |
| Next.js middleware | Relying on middleware as the sole auth check | Always verify auth inside the Route Handler too — middleware can be bypassed (CVE-2025-29927) |
| Vercel env vars | Adding secrets to `NEXT_PUBLIC_` prefix | Server-only secrets must never use `NEXT_PUBLIC_` — they will be bundled into the client JS |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 Supabase queries in the admin table | Dashboard slow to load; Supabase query count spikes | Use a single query with `order`, `limit`, and optional filters — no per-row fetching | At ~100 rows with lazy loading disabled |
| Resend rate limit (2 req/sec default) | `429` errors when notifying multiple admins simultaneously | Use `resend.batch.send()` to send all admin notification emails in one API call (up to 100 per call) | When `ADMIN_EMAILS` contains more than 2 addresses and emails are sent sequentially |
| Full table scan on blackout date check | Slow auto-deny check at form submission | Index `blackout_dates` on `(start_date, end_date)`; query only overlapping ranges | At ~500+ blackout date rows (unlikely but good practice) |
| Supabase client instantiated at module scope | Stale cookies; cross-request data leakage in serverless | Instantiate `createServerClient` inside the request handler function, not at module top level | Immediately in production serverless — each invocation must get fresh cookies |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No rate limiting on the public form submission endpoint | Spam requests flood the admin inbox and database | Add a simple in-memory or Upstash rate limit on the form submission Route Handler (e.g., 5 submissions per IP per hour) |
| `APPROVAL_SECRET` in URL query param — logged by proxies | Secret visible in Vercel function logs, browser history, and email client URL prefetching | Accept as a known tradeoff for this project's simplicity; mitigate by checking `reviewed` status so replayed links are harmless |
| Admin session cookie without `httpOnly` | JavaScript XSS can steal the session cookie | Always set `httpOnly: true` on the admin session cookie |
| Admin session cookie without expiry | Session persists forever if browser is left open | Set `maxAge` to a reasonable value (e.g., 8 hours / one school day) |
| Supabase service role key used in browser client | Service role key bypasses RLS — if exposed, attacker has full DB access | Service role key must only appear in server-side code; never in `NEXT_PUBLIC_*` or Client Components |
| No input validation on form fields before DB insert | Malformed data or SQL injection via ORM | Validate all form inputs with Zod before passing to Supabase; Supabase JS client uses parameterized queries (no raw SQL injection) but validation is still required for business logic |
| Approval action does not confirm request is `pending` | Admin can be tricked into "approving" an already-denied request via a replayed link | Query `status` before applying update; reject if not `pending` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No confirmation page after form submit | Teacher has no idea if the form worked | Redirect to a dedicated `/submitted` success page with the request summary |
| Approval link shows raw error page on already-reviewed request | Admin is confused; looks like a system failure | Return a friendly "This request has already been reviewed" page with the current status |
| Email approval buttons are plain URL text, not styled buttons | Email clients may not render them; admins skip the email | Use HTML `<a>` tags styled as buttons; test in Gmail and Outlook |
| Auto-deny email sent with no explanation | Teacher does not know what a blackout date is | Include a brief sentence in the auto-deny email explaining the blackout date policy |
| Admin dashboard has no empty state | New deployment looks broken with a blank table | Show a "No requests yet" message when the requests table is empty |

---

## "Looks Done But Isn't" Checklist

- [ ] **Admin auth:** Cookie is set after login — verify the `HttpOnly` and `Secure` flags are present in browser DevTools → Application → Cookies, not just that the redirect happened
- [ ] **Approval flow:** Clicking the approval link a second time shows the "already reviewed" page — not a success message or a second DB update
- [ ] **Blackout auto-deny:** A request submitted with the blackout checkbox checked triggers an immediate denial email to the teacher — verify the email actually arrives, not just that the DB row is marked denied
- [ ] **Admin notification email:** All addresses in `ADMIN_EMAILS` (comma-separated) receive the email — not just the first one
- [ ] **Environment variables:** `APPROVAL_SECRET`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` return `undefined` when logged from a `"use client"` component — confirm they are not in the JS bundle
- [ ] **Resend domain:** Resend dashboard shows the sending domain as "Verified" with green checkmarks on all DNS records — not "Pending"
- [ ] **Form double-submit:** Submitting the form twice quickly creates only one database row — not two
- [ ] **RLS / access control:** A direct `curl` to `https://<project>.supabase.co/rest/v1/requests` using the anon key returns an error or empty result — not all rows

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong Supabase client used in wrong context | LOW | Move the import to the correct utility file; fix the component boundary |
| Middleware-only auth bypass discovered post-launch | MEDIUM | Add in-handler auth checks to all admin routes; patch Next.js to 14.2.25+ |
| Shared token replayed to change a reviewed request | LOW | "Already reviewed" guard prevents effect; no data corruption possible |
| Secrets exposed in JS bundle | HIGH | Rotate `APPROVAL_SECRET` and `ADMIN_PASSWORD` immediately; remove `NEXT_PUBLIC_` prefix; redeploy |
| RLS disabled — data exposed | HIGH | Enable RLS immediately; audit Supabase logs for unexpected reads; notify affected users if PII was accessed |
| Duplicate form submissions in production | LOW | Deduplicate via unique constraint on `(teacher_email, start_date, end_date)` in DB; delete duplicates manually |
| Email delivery failures (unverified domain) | MEDIUM | Complete Resend DNS verification; resend missed notifications manually via Resend dashboard |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrong Supabase client context | Phase 1: Foundation / setup | Build succeeds; no `next/headers` import errors in client components |
| Middleware-only auth (CVE-2025-29927) | Phase 3: Admin dashboard | Every admin route handler has an explicit cookie check returning 401 |
| Shared token replay effect | Phase 2: Email workflow | Second click on approval link returns "already reviewed" page |
| Secrets in JS bundle | Phase 1: Foundation / setup | `NEXT_PUBLIC_` audit passes; secrets undefined in client context |
| Supabase RLS disabled | Phase 1: Foundation / setup | Supabase dashboard linter shows no RLS warnings |
| Cookie misconfiguration | Phase 3: Admin dashboard | Cookie has `HttpOnly`, `Secure`, `SameSite` flags in DevTools |
| Email before DB write race | Phase 2: Email workflow | Insert failure tested; email is not sent when insert fails |
| Double form submission | Phase 2: Form submission | Submit button disables on click; only one DB row created per submit |
| `requestId` not validated | Phase 2: Email workflow | Handler fetches and confirms row before updating |
| Unverified Resend domain | Phase 2: Email setup (pre-feature) | Resend dashboard shows "Verified" before any email feature is built |
| Deprecated auth-helpers package | Phase 1: Foundation / setup | `package.json` contains `@supabase/ssr` only, no `auth-helpers-nextjs` |

---

## Sources

- Supabase SSR docs — creating server client: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase troubleshooting Next.js auth issues: https://supabase.com/docs/guides/troubleshooting/how-do-you-troubleshoot-nextjs---supabase-auth-issues-riMCZV
- Supabase `AuthSessionMissingError` in Next.js 14 API routes (GitHub issue): https://github.com/supabase/ssr/issues/107
- Supabase RLS disabled security risk discussion: https://github.com/orgs/supabase/discussions/26584
- CVE-2025-29927 Next.js middleware bypass (CVSS 9.1): https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass
- CVE-2025-29927 Datadog security analysis: https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/
- Next.js cookie API reference: https://nextjs.org/docs/app/api-reference/functions/cookies
- Next.js NEXT_PUBLIC_ env var pitfalls: https://dev.to/koyablue/the-pitfalls-of-nextpublic-environment-variables-96c
- Resend rate limiting docs: https://resend.com/docs/api-reference/rate-limit
- Resend idempotency keys: https://resend.com/blog/engineering-idempotency-keys
- Resend deliverability tips: https://resend.com/blog/top-10-email-deliverability-tips
- SPF/DKIM common mistakes: https://www.infraforge.ai/blog/spf-dkim-dmarc-common-setup-mistakes
- Next.js hidden Server Actions pitfalls (Medium): https://medium.com/@amit.akoka98/the-hidden-pitfalls-of-server-actions-in-next-js-a-real-world-lesson-1a8bc60759a9
- Next.js CORS in App Router: https://github.com/vercel/next.js/discussions/64115
- Cookie-based auth for Next.js 13+ apps: https://dev.to/cibrax/cookie-based-authentication-for-nextjs-13-apps-4bad
- Supabase RLS "your database is public if RLS is off" (HN thread): https://news.ycombinator.com/item?id=46355345

---
*Pitfalls research for: Teacher Time-Off Request System (Next.js 14 App Router + Supabase + Resend)*
*Researched: 2026-03-10*
