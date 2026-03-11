# Project Research Summary

**Project:** Teacher Time-Off Request System
**Domain:** K-12 school leave management / email-workflow approval
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

This is a lightweight, single-school leave management tool built to replace paper and ad-hoc email processes. The recommended approach is a Next.js 15 App Router application deployed on Vercel, backed by Supabase Postgres, with Resend handling transactional email. The defining architectural choice is an email-first approval workflow: admins approve or deny requests by clicking tokenized links directly from their inbox, with no portal login required. This is the core differentiator from enterprise systems like Frontline/Aesop, which require admins to log into a portal. Teachers submit via a fully public form with no account creation, eliminating credential friction for infrequent users.

The recommended stack is lean and well-matched to the problem. `iron-session` handles admin session management without NextAuth's OAuth overhead. `@supabase/ssr` (not the deprecated `auth-helpers`) manages cookie-aware server clients. Zod validates form payloads before they reach the database. Raw HTML email templates via Resend are the right call — React Email adds build complexity for no benefit given 3-4 simple notification email types. Tailwind v4 with the `@tailwindcss/forms` plugin handles styling.

The most significant risks are security-related, not feature-related: the shared `APPROVAL_SECRET` token in email URLs must be paired with an idempotency check on request status, secrets must never appear in `NEXT_PUBLIC_` env vars, Supabase RLS must be enabled or the anon key must never reach the browser, and admin auth must be double-checked at the route handler level due to CVE-2025-29927 (Next.js middleware bypass). All of these have straightforward mitigations that need to be baked into implementation from the foundation phase rather than retrofitted.

---

## Key Findings

### Recommended Stack

The stack is fully specified and all components are well-supported. Next.js 15 (not 14 as originally noted in the spec — 15 is current stable and a drop-in migration) with React 19 is the recommended build target. The primary distinction from naive implementations is the two-client Supabase pattern: `lib/supabase/server.ts` using `@supabase/ssr`'s `createServerClient` for all server-side code, and a browser client kept entirely out of this project (no user-facing auth). The `cookies()` API must be `await`ed in Next.js 15, unlike 14.

**Core technologies:**
- **Next.js 15 + React 19**: Full-stack framework — App Router, Server Actions for form mutations, Route Handlers for email-link endpoints
- **Supabase (`@supabase/supabase-js` + `@supabase/ssr`)**: Postgres database with cookie-aware server client; anon key is server-only in this project
- **Resend**: Transactional email delivery — minimal API, first-class Next.js support, no SMTP config
- **iron-session**: httpOnly cookie session for admin password auth — correct tool for single shared password; no NextAuth overhead
- **Zod**: Runtime validation of form submissions before DB writes
- **Tailwind CSS v4**: CSS-first config via `@import "tailwindcss"` and `@plugin "@tailwindcss/forms"`

### Expected Features

The feature set is well-scoped. Every P1 feature maps directly to a concrete user need, and the anti-features section is unusually valuable — it explicitly names what not to build (teacher accounts, leave balance tracking, substitute management, real-time WebSockets) and explains why each would be scope creep for single-school deployment.

**Must have (table stakes):**
- Public submission form (name, email, dates, leave type, reason) — entry point; nothing works without it
- Blackout date auto-denial at submission with immediate teacher email — prevents admin noise from already-blocked periods
- Admin notification email with tokenized approve/deny links — the core workflow
- Tokenized approval Route Handler with already-reviewed idempotency guard
- Teacher confirmation email on approval or denial
- Admin dashboard: requests table (sortable, filterable by status)
- Admin dashboard: blackout date CRUD (add named range, list, delete)
- Admin dashboard password protection (cookie session, env-var password)

**Should have (competitive):**
- No-login teacher experience — pure public form, no credentials
- No-login admin email approval — one-click-from-inbox beats portal-based systems
- Status badge in requests table (Pending/Approved/Denied at a glance)
- Blackout date label/reason included in auto-deny email
- Deny with custom reason from dashboard
- CSV export of request history

**Defer (v2+):**
- Teacher request history (token-based, no login)
- Per-leave-type policy rules (advance notice requirements)
- Absence trend analytics
- Multi-school / district mode
- Calendar API integration (Google/Outlook)

### Architecture Approach

The architecture is a standard Next.js App Router pattern with clean separation between teacher-facing (public Server Component + Server Action), admin email-link handling (Route Handler — required because email clients issue GET requests, not POST), and admin dashboard (Server Components behind cookie auth with double-checked middleware). All server-side DB access flows through a single `lib/supabase/server.ts` factory. Email sending is abstracted behind `lib/email/send.ts` wrapping Resend. Admin session management lives in `lib/auth/session.ts`. This separation ensures that if any external dependency changes, only one file changes.

**Major components:**
1. **`app/page.tsx` + `app/actions/submit.ts`** — Public teacher form and submission Server Action; validates, writes to DB, checks blackout flag, sends appropriate email, redirects to success page
2. **`app/api/approve/route.ts`** — GET Route Handler for tokenized email approval/denial links; validates token, checks idempotency, updates status, sends teacher confirmation
3. **`app/admin/*` + `lib/auth/session.ts`** — Password-protected admin dashboard with middleware + layout double-check; blackout date management; requests table
4. **`lib/supabase/server.ts`** — Single `createClient()` factory used by all server-side callers; never duplicated
5. **`lib/email/send.ts` + `lib/email/templates/`** — Resend wrapper and HTML template functions for all 4 email types (submission confirmation, admin notification, teacher approval/denial, auto-deny)

### Critical Pitfalls

1. **Wrong Supabase client in wrong context** — `createServerClient` in a `"use client"` file causes build failures; browser client on server loses cookie state. Fix: two dedicated files from day one, never cross-imported.
2. **Middleware-only admin auth (CVE-2025-29927)** — Next.js middleware can be bypassed via `x-middleware-subrequest` header injection (CVSS 9.1). Fix: verify cookie value inside every admin Route Handler and Server Action in addition to middleware.
3. **Approval token replay without idempotency** — Shared `APPROVAL_SECRET` links remain valid forever. Fix: always query request `status` before acting; if not `pending`, redirect to already-reviewed page. Replay links become harmless.
4. **Secrets exposed in JS bundle** — `APPROVAL_SECRET`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` must never use `NEXT_PUBLIC_` prefix or be passed as props to Client Components. Fix: enforce as naming convention at project setup; audit before deploy.
5. **Supabase RLS disabled on public tables** — Anon key is publicly visible if ever used browser-side; without RLS, anyone can query all request data. Fix: either keep anon key server-side only (preferred for this architecture) or enable RLS with service-role-only policies.
6. **Email before DB write / race condition** — Email sent before confirming DB insert succeeded produces orphaned confirmations. Fix: check Supabase error after insert; only call Resend if insert succeeded.
7. **Unverified Resend sending domain** — DNS verification (SPF/DKIM) must be completed before any email feature is live; Resend returns 200 but emails don't deliver. Fix: add domain verification as a pre-deploy checklist step.

---

## Implications for Roadmap

The architecture research explicitly defines a build order based on feature dependencies. All four research files converge on the same phase structure: foundation first, teacher-facing core second, email workflow third, admin layer fourth. This ordering is enforced by dependencies — blackout CRUD must exist before auto-denial can work; the email module must exist before any notification features; auth must exist before the dashboard.

### Phase 1: Foundation and Database Setup

**Rationale:** Every other phase depends on the database schema and Supabase client being correctly wired. Security mistakes (RLS, secret exposure, wrong client context) that are fixed at the foundation phase cost nothing; the same mistakes discovered in Phase 4 require touching every file. This phase also establishes the `lib/` module boundaries that keep later phases clean.
**Delivers:** Working Supabase project with `requests` and `blackout_dates` tables, typed client factory, env var structure, Resend domain verified, project scaffolded with Tailwind v4
**Addresses:** Initial data model, dev environment, email infrastructure prerequisite
**Avoids:** Wrong Supabase client context (Pitfall 1), secrets in JS bundle (Pitfall 4), RLS disabled (Pitfall 5), deprecated `auth-helpers` package (Pitfall 11), unverified Resend domain (Pitfall 10)

### Phase 2: Teacher Submission Form and Blackout Auto-Denial

**Rationale:** The public submission form is the entry point for the entire system. Nothing can be tested end-to-end until a request exists in the database. Blackout auto-denial is coupled to the submission action and requires the `blackout_dates` table — build them together. The form also validates the double-submit protection pattern (Pitfall 8) before it gets more complex.
**Delivers:** Fully functional public form at `/`; requests inserted into DB; blackout check at submission; auto-deny email to teacher; on-screen submission confirmation; redirect to success page
**Uses:** Next.js Server Action, Zod validation, `lib/supabase/server.ts`, `lib/email/send.ts` (first use)
**Implements:** Teacher submission flow (Flow 1 from ARCHITECTURE.md)
**Avoids:** Double form submission (Pitfall 8), email before DB write (Pitfall 7), redirect inside try/catch (Architecture Anti-Pattern 4)

### Phase 3: Admin Email Notification and Approval Workflow

**Rationale:** The email-based approve/deny flow is the core differentiator and the most security-sensitive component. Building it as a dedicated phase keeps security focus clear. The already-reviewed guard, token validation, and `requestId` database confirmation must all be implemented together — partial implementation creates the replay vulnerability described in Pitfalls 3 and 9.
**Delivers:** Admin notification email with approve/deny links on non-blackout submission; `/api/approve` Route Handler with full token validation, idempotency check, status update, and teacher confirmation email; `/already-reviewed` friendly page
**Uses:** Resend (admin notification + teacher confirmation templates), Route Handler (GET — email clients require this, not Server Actions), `APPROVAL_SECRET` env var
**Implements:** Admin approval flow (Flow 2 from ARCHITECTURE.md)
**Avoids:** Server Action used for approval link (Architecture Anti-Pattern 1), shared token replay effect (Pitfall 3), `requestId` not validated (Pitfall 9)

### Phase 4: Admin Dashboard and Blackout Date Management

**Rationale:** Admin dashboard is the last piece because it depends on requests existing (Phase 2) and the approval flow working (Phase 3). Auth implementation here also closes the middleware bypass risk — building it last means the double-check pattern (middleware + layout guard) is added with full awareness of CVE-2025-29927.
**Delivers:** Password-protected `/admin` dashboard with requests table (sortable, filterable by status/leave type); blackout date CRUD (add named range with label, list, delete); admin login page; httpOnly cookie session with 8-hour expiry; middleware redirect + layout double-check
**Uses:** `iron-session`, `lib/auth/session.ts`, Admin Server Actions for blackout CRUD, `revalidatePath` for dashboard refresh
**Implements:** Admin dashboard flow (Flow 3) and blackout date management flow (Flow 4) from ARCHITECTURE.md
**Avoids:** Middleware-only admin auth CVE-2025-29927 (Pitfall 2), cookie misconfiguration (Pitfall 6), storing admin password in cookie (Architecture Anti-Pattern 5)

### Phase 5: Polish and Pre-Launch Hardening

**Rationale:** The "looks done but isn't" checklist from PITFALLS.md identifies a set of behaviors that pass visual inspection but are broken in practice. This phase addresses UX gaps, verifies all security properties, and adds v1.x features that are low effort but high value after the core is validated.
**Delivers:** Empty state in admin table; styled email approve/deny buttons (not raw URLs); deny with custom reason from dashboard; form double-submit protection verified; end-to-end test of approval flow second-click behavior; Resend domain verified; RLS audit; secret bundle audit; `ADMIN_EMAILS` multi-address smoke test
**Addresses:** All items from "Looks Done But Isn't" checklist in PITFALLS.md; UX pitfalls (friendly error pages, styled email buttons, auto-deny explanation text)

### Phase Ordering Rationale

- **Foundation before features** enforces correct security posture from the start; retrofitting env var discipline and client separation is expensive.
- **Teacher form before admin flow** because the approval workflow is meaningless without requests to approve; also surfaces DB schema issues early.
- **Email workflow before admin dashboard** because the dashboard is a fallback approval path — the email flow is the primary path and should be validated first.
- **Auth last (of functional phases)** because admin dashboard is the only route requiring auth; building auth earlier would mean testing against routes that don't exist yet.
- **The build order in ARCHITECTURE.md** (steps 1-10) directly maps to these 4 functional phases plus the hardening phase, confirming the research is internally consistent.

### Research Flags

Phases with standard, well-documented patterns (skip research-phase during planning):
- **Phase 1 (Foundation):** Next.js scaffolding, Tailwind v4 PostCSS setup, and Supabase table creation are fully documented in official sources. STACK.md provides exact installation commands and env var structure.
- **Phase 2 (Teacher form):** Server Action form handling is a canonical Next.js pattern. Zod validation is standard. No novel integrations.
- **Phase 4 (Admin dashboard):** `iron-session` cookie pattern is documented in STACK.md with exact implementation. Supabase queries are straightforward selects/inserts/deletes.
- **Phase 5 (Polish):** No novel implementation; checklist items against known patterns.

Phases likely needing closer attention during implementation (not full research, but careful reference to existing docs):
- **Phase 3 (Approval workflow):** The Route Handler token validation pattern has several interdependent requirements (token check, `requestId` DB confirmation, idempotency, status update atomicity, teacher email trigger) that must all be correct simultaneously. ARCHITECTURE.md provides a complete code example — follow it exactly. Do not simplify.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All major packages verified against official docs and current releases (2026-03-10). Next.js 15 / React 19 peer dependency confirmed. `@supabase/ssr` v0.9.x and `@supabase/supabase-js` v2.99.x confirmed. One MEDIUM caveat: version numbers sourced from npm search, not official changelog. |
| Features | MEDIUM-HIGH | Core features drawn from incumbent product analysis (Frontline/Aesop, Red Rover) and leave management UX patterns. School-specific nuances (blackout dates, no-login flows) well-supported by domain knowledge. Competitor feature claims are from marketing pages (MEDIUM confidence), not technical docs. |
| Architecture | HIGH | Based on official Next.js and Supabase docs. All patterns verified. Data flow diagrams are consistent with both the Stack and Features research. Build order is internally consistent across all three research files. |
| Pitfalls | HIGH | CVE-2025-29927 sourced from security research (Datadog, ProjectDiscovery). Supabase client context issues sourced from official troubleshooting docs and verified GitHub issues. Resend deliverability guidance sourced from Resend's own blog. All pitfalls have confirmed prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Next.js 14 vs 15:** The original project spec references Next.js 14. STACK.md recommends 15. If 14 is a hard constraint, `cookies()` is synchronous (no `await`) and `useFormState` replaces `useActionState`. Clarify before starting Phase 1.
- **Supabase anon key vs service role key:** ARCHITECTURE.md notes the anon key is used for all server-side queries in this project. PITFALLS.md suggests using the service role key server-side to simplify RLS setup. Decide on one pattern at the start of Phase 1 and document it. Either is correct; inconsistency is not.
- **Rate limiting on the public form:** PITFALLS.md flags lack of rate limiting as a security concern (spam requests flood admin inbox). No solution is fully specified — Upstash Redis rate limiting is mentioned as an option. This is a pre-launch concern; address in Phase 5 hardening.
- **`ADMIN_EMAILS` multi-address handling:** The env var stores a comma-separated list of admin email addresses. No code for parsing and iterating this list appears in the research. The Resend `batch.send()` API (mentioned in PITFALLS.md performance traps) is the correct approach. Implement in Phase 3.

---

## Sources

### Primary (HIGH confidence)
- [Supabase: Creating a client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — server client patterns, cookie handling
- [Supabase: Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` package patterns
- [Next.js: Upgrading to version 15](https://nextjs.org/docs/app/guides/upgrading/version-15) — async cookies(), breaking changes
- [Next.js: Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — GET handler pattern for email links
- [Next.js: Server Actions](https://nextjs.org/docs/app/getting-started/updating-data) — form submission pattern
- [Next.js: Authentication guide](https://nextjs.org/docs/app/guides/authentication) — httpOnly cookie session pattern
- [Resend: Send emails with Next.js](https://resend.com/docs/send-with-nextjs) — SDK usage and route handler pattern
- [Tailwind CSS v4.0 release blog](https://tailwindcss.com/blog/tailwindcss-v4) — v4 installation and CSS-first config
- [CVE-2025-29927 — Datadog security analysis](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/) — middleware bypass vulnerability
- [CVE-2025-29927 — ProjectDiscovery](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass) — CVSS 9.1 confirmation

### Secondary (MEDIUM confidence)
- [MakerKit: Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — decision framework
- [GitHub: tailwindlabs/tailwindcss-forms](https://github.com/tailwindlabs/tailwindcss-forms) — v4 compatibility via `@plugin` directive
- [Frontline Education — Absence Management](https://www.frontlineeducation.com/school-hcm-software/absence-management/) — competitor feature baseline
- [Red Rover K-12 Absence Management](https://www.redroverk12.com/absence-management) — competitor feature baseline
- [LeaveBoard — HR Dashboard](https://leaveboard.com/hr-dashboard/) — dashboard feature patterns
- [Resend: Top 10 Email Deliverability Tips](https://resend.com/blog/top-10-email-deliverability-tips) — DNS verification requirements

### Tertiary (LOW confidence)
- [Everhour — Leave Management Systems 2025](https://everhour.com/blog/leave-management-systems/) — market overview (secondary aggregator)
- npm package version searches for `@supabase/ssr`, `@supabase/supabase-js`, `resend` — version numbers current as of 2026-03-10

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
